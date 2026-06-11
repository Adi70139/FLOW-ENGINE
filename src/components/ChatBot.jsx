import { useEffect, useRef, useState } from "react";
import { api } from "../utils/api";
import { useModules } from "../context/CollectionContext";
import { toast } from "./ui/toast/toast";
import styles from "./ChatBot.module.css";

const STORAGE_KEY = "mr_auto_assistant_history_v1";
const MAX_HISTORY = 20;
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB safety cap
const ACCEPTED_FILE_TYPES = ".json,.yaml,.yml,.har,application/json,application/x-yaml,text/yaml";

function isHarFile(file) {
  return !!file && (file.name || "").toLowerCase().endsWith(".har");
}

function stripExtension(name = "") {
  const idx = name.lastIndexOf(".");
  return idx > 0 ? name.slice(0, idx) : name;
}

function formatBytes(bytes) {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Friendly retry-after formatter: "8.1099s" → "a few seconds", "75s" → "about 1 minute".
function formatRetryAfter(rawValue, rawUnit) {
  const num = Number(rawValue);
  if (!Number.isFinite(num) || num <= 0) return "";
  const unit = (rawUnit || "s").toLowerCase();
  let seconds = num;
  if (unit.startsWith("ms")) seconds = num / 1000;
  else if (unit.startsWith("m") && !unit.startsWith("ms")) seconds = num * 60;
  else if (unit.startsWith("h")) seconds = num * 3600;

  if (seconds < 10) return "a few seconds";
  if (seconds < 60) return `about ${Math.ceil(seconds)} seconds`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes === 1) return "about 1 minute";
  if (minutes < 60) return `about ${minutes} minutes`;
  const hours = Math.ceil(minutes / 60);
  return hours === 1 ? "about 1 hour" : `about ${hours} hours`;
}

// Detects rate-limit messages from the backend (e.g. Groq / OpenAI style errors
// surfaced through the assistant) and rewrites them into a short user-friendly note.
function friendlyAssistantText(text) {
  if (!text || typeof text !== "string") return text;
  const lower = text.toLowerCase();
  const looksRateLimited =
    lower.includes("rate_limit_exceeded") ||
    lower.includes("rate limit reached") ||
    lower.includes("rate limit exceeded") ||
    lower.includes("too many requests");
  if (!looksRateLimited) return text;

  const retryMatch =
    text.match(/try again in\s+([\d.]+)\s*(ms|s|sec(?:onds?)?|m|min(?:utes?)?|h|hours?)/i) ||
    text.match(/retry\s+after\s+([\d.]+)\s*(ms|s|sec(?:onds?)?|m|min(?:utes?)?|h|hours?)/i);

  const wait = retryMatch ? formatRetryAfter(retryMatch[1], retryMatch[2]) : "";
  return wait
    ? `Assistant is facing heavy traffic right now. Please try again in ${wait}.`
    : "Assistant is facing heavy traffic right now. Please try again in a moment.";
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(messages) {
  try {
    const trimmed = messages.slice(-MAX_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn("Failed to persist assistant history:", e);
  }
}

function ChatBot() {
  const { modules = [], selectedModuleId, dispatch } = useModules();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => loadHistory());
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [executeActions, setExecuteActions] = useState(false);
  const [pendingConfirmFor, setPendingConfirmFor] = useState(null);
  const [unread, setUnread] = useState(false);

  // ── Attachment / upload state ──
  const [attachedFile, setAttachedFile] = useState(null);
  const [importModuleId, setImportModuleId] = useState("");
  const [importFlowName, setImportFlowName] = useState("");
  const [filterDomain, setFilterDomain] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const scrollerRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages, open]);

  useEffect(() => {
    if (open) {
      setUnread(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Default the import module to the currently selected module (if any) when attaching.
  useEffect(() => {
    if (!attachedFile) return;
    if (importModuleId) return;
    if (selectedModuleId) {
      setImportModuleId(String(selectedModuleId));
    } else if (modules.length > 0) {
      setImportModuleId(String(modules[0].id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachedFile]);

  function buildHistoryPayload(extra = []) {
    return [...messages, ...extra]
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }))
      .slice(-MAX_HISTORY);
  }

  async function sendMessage(text, { execute } = {}) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const userMsg = { role: "user", content: trimmed, ts: Date.now() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    setPendingConfirmFor(null);

    try {
      const res = await api.assistantChat({
        message: trimmed,
        executeActions: execute ?? executeActions,
        history: buildHistoryPayload(),
      });

      const rawReply = res?.reply || "(no reply)";
      const friendlyReply = friendlyAssistantText(rawReply);
      const wasRateLimited = friendlyReply !== rawReply;

      const assistantMsg = {
        role: "assistant",
        content: friendlyReply,
        actions: Array.isArray(res?.actions) ? res.actions : [],
        confirmationRequired: !!res?.confirmationRequired,
        executed: !!(execute ?? executeActions),
        prompt: trimmed,
        error: wasRateLimited,
        ts: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (assistantMsg.confirmationRequired && !assistantMsg.executed) {
        setPendingConfirmFor(trimmed);
      }
      if (!open) setUnread(true);
    } catch (err) {
      const friendly =
        friendlyAssistantText(err?.message) || err?.message || "The assistant request failed.";
      const errMsg = {
        role: "assistant",
        content: friendly,
        error: true,
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
      toast.error(friendly);
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (attachedFile) {
      handleUpload();
      return;
    }
    sendMessage(input);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (attachedFile) {
        handleUpload();
        return;
      }
      sendMessage(input);
    }
  }

  function handleConfirmRun() {
    if (pendingConfirmFor) {
      sendMessage(pendingConfirmFor, { execute: true });
    }
  }

  function handleClear() {
    setMessages([]);
    setPendingConfirmFor(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  function handleAttachClick() {
    fileInputRef.current?.click();
  }

  function handleFileSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setUploadError(`File is too large (${formatBytes(file.size)}). Max ${formatBytes(MAX_FILE_BYTES)}.`);
      return;
    }
    setUploadError("");
    setAttachedFile(file);
    setImportFlowName(stripExtension(file.name) || "Imported Flow");
    if (!isHarFile(file)) setFilterDomain("");
  }

  function clearAttachment() {
    setAttachedFile(null);
    setImportFlowName("");
    setFilterDomain("");
    setUploadError("");
  }

  async function handleUpload() {
    if (!attachedFile || uploading) return;
    if (!importModuleId) {
      setUploadError("Pick a module to import into.");
      return;
    }
    if (!importFlowName.trim()) {
      setUploadError("Flow name is required.");
      return;
    }

    const file = attachedFile;
    const flowName = importFlowName.trim();
    const moduleId = importModuleId;
    const moduleName = modules.find((m) => String(m.id) === String(moduleId))?.name || `module ${moduleId}`;
    const domain = isHarFile(file) ? filterDomain.trim() : "";

    const userMsg = {
      role: "user",
      content: `Uploaded ${file.name} (${formatBytes(file.size)}) — import into "${moduleName}" as flow "${flowName}".`,
      ts: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setUploading(true);
    setUploadError("");

    try {
      const flow = await api.assistantUpload({
        file,
        moduleId,
        flowName,
        filterDomain: domain || undefined,
      });

      // Keep the sidebar in sync so the new flow shows up immediately.
      if (flow && dispatch) {
        dispatch({ type: "ADD_FLOW", moduleId, flow });
      }

      const assistantMsg = {
        role: "assistant",
        content: `Imported "${flow?.name || flowName}" into module "${moduleName}".`,
        actions: [
          {
            action: "assistant.upload",
            arguments: {
              moduleId: Number(moduleId),
              flowName,
              fileName: file.name,
              ...(domain ? { filterDomain: domain } : {}),
            },
            status: "success",
            result: flow
              ? {
                  flowId: flow.id,
                  name: flow.name,
                  steps: flow.steps?.length ?? flow.stepCount,
                }
              : undefined,
          },
        ],
        executed: true,
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      clearAttachment();
      toast.success(`Imported "${flow?.name || flowName}"`);
      if (!open) setUnread(true);
    } catch (err) {
      const message = err?.message || "Upload failed.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: message,
          actions: [
            {
              action: "assistant.upload",
              arguments: {
                moduleId: Number(moduleId),
                flowName,
                fileName: file.name,
              },
              status: "failed",
              error: message,
            },
          ],
          executed: true,
          error: true,
          ts: Date.now(),
        },
      ]);
      setUploadError(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }

  const hasExecutedSuccess = messages.some(
    (m) => m.role === "assistant" && m.executed && (m.actions || []).some((a) => a?.status && a.status.toLowerCase() === "success")
  );

  return (
    <>
      <button
        type="button"
        className={styles.fab}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close assistant" : "Open assistant"}
        title={open ? "Close assistant" : "Ask the Flow Engine assistant"}
      >
        <span className={styles.fabIcon}>{open ? "×" : "💬"}</span>
        {!open && unread && <span className={styles.fabDot} />}
      </button>

      {open && (
        <div className={styles.panel} role="dialog" aria-label="Flow Engine assistant">
          <div className={styles.header}>
            <div className={styles.headerTitle}>
              <span className={styles.headerIcon}>🤖</span>
              <div>
                <div className={styles.headerName}>Flow Engine Assistant</div>
                <div className={styles.headerSub}>
                  Ask about modules, flows, steps — or have it build them.
                </div>
              </div>
            </div>
            <button
              type="button"
              className={styles.headerClose}
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className={styles.scroller} ref={scrollerRef}>
            {messages.length === 0 && (
              <div className={styles.emptyHint}>
                <p>👋 Hi! I can answer questions about your Flow Engine setup and create resources for you.</p>
                <p className={styles.emptyExamples}>Try:</p>
                <ul>
                  <li>“List all my modules”</li>
                  <li>“Create a new flow called Smoke Tests in module Auth”</li>
                  <li>“Add a GET step to flow 12 hitting /users”</li>
                </ul>
              </div>
            )}

            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`${styles.msg} ${m.role === "user" ? styles.msgUser : styles.msgAssistant} ${m.error ? styles.msgError : ""}`}
              >
                <div className={styles.msgBubble}>
                  <div className={styles.msgContent}>{m.content}</div>

                  {m.role === "assistant" && m.actions && m.actions.length > 0 && (
                    <div className={styles.actions}>
                      <div className={styles.actionsLabel}>
                        {m.executed ? "Actions executed" : "Proposed actions"}
                      </div>
                      {m.actions.map((a, i) => {
                        const status = (a?.status || "").toLowerCase();
                        const statusClass =
                          status === "success"
                            ? styles.statusSuccess
                            : status === "failed" || status === "error"
                              ? styles.statusFailed
                              : styles.statusPending;
                        return (
                          <div key={i} className={styles.actionItem}>
                            <div className={styles.actionRow}>
                              <span className={styles.actionName}>{a?.action || "action"}</span>
                              {a?.status && (
                                <span className={`${styles.statusPill} ${statusClass}`}>
                                  {a.status}
                                </span>
                              )}
                            </div>
                            {a?.arguments && Object.keys(a.arguments).length > 0 && (
                              <pre className={styles.actionArgs}>
                                {JSON.stringify(a.arguments, null, 2)}
                              </pre>
                            )}
                            {a?.error && (
                              <div className={styles.actionError}>{a.error}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {m.role === "assistant" && m.confirmationRequired && !m.executed && idx === messages.length - 1 && (
                    <div className={styles.confirmBar}>
                      <span>Run these actions?</span>
                      <button
                        type="button"
                        className={styles.confirmBtn}
                        onClick={handleConfirmRun}
                        disabled={sending}
                      >
                        Yes, run
                      </button>
                      <button
                        type="button"
                        className={styles.confirmCancel}
                        onClick={() => setPendingConfirmFor(null)}
                        disabled={sending}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className={`${styles.msg} ${styles.msgAssistant}`}>
                <div className={styles.msgBubble}>
                  <div className={styles.typing}>
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            )}
          </div>

          {hasExecutedSuccess && (
            <button
              type="button"
              className={styles.refreshBar}
              onClick={() => window.location.reload()}
              title="Reload to see changes made by the assistant"
            >
              ↻ Refresh app to see changes
            </button>
          )}

          <form className={styles.composer} onSubmit={handleSubmit}>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              onChange={handleFileSelected}
              style={{ display: "none" }}
            />

            {attachedFile && (
              <div className={styles.attachmentCard}>
                <div className={styles.attachmentHead}>
                  <span className={styles.attachmentIcon}>📎</span>
                  <div className={styles.attachmentMeta}>
                    <div className={styles.attachmentName} title={attachedFile.name}>{attachedFile.name}</div>
                    <div className={styles.attachmentSize}>{formatBytes(attachedFile.size)}</div>
                  </div>
                  <button
                    type="button"
                    className={styles.attachmentRemove}
                    onClick={clearAttachment}
                    disabled={uploading}
                    aria-label="Remove attachment"
                    title="Remove attachment"
                  >
                    ×
                  </button>
                </div>

                <div className={styles.importRow}>
                  <label className={styles.importField}>
                    <span>Module</span>
                    <select
                      value={importModuleId}
                      onChange={(e) => setImportModuleId(e.target.value)}
                      disabled={uploading || modules.length === 0}
                    >
                      {modules.length === 0 && <option value="">No modules</option>}
                      {modules.length > 0 && !importModuleId && (
                        <option value="">— Select module —</option>
                      )}
                      {modules.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.importField}>
                    <span>Flow name</span>
                    <input
                      type="text"
                      value={importFlowName}
                      onChange={(e) => setImportFlowName(e.target.value)}
                      placeholder="e.g. Smoke Tests"
                      disabled={uploading}
                    />
                  </label>
                </div>

                {isHarFile(attachedFile) && (
                  <label className={styles.importField}>
                    <span>Filter domain <em>(optional, HAR only)</em></span>
                    <input
                      type="text"
                      value={filterDomain}
                      onChange={(e) => setFilterDomain(e.target.value)}
                      placeholder="e.g. api.example.com"
                      disabled={uploading}
                    />
                  </label>
                )}

                <div className={styles.attachmentHint}>
                  Type auto-detected from file (Postman / Swagger / HAR).
                </div>

                {uploadError && (
                  <div className={styles.attachmentError}>{uploadError}</div>
                )}
              </div>
            )}

            <label className={styles.executeToggle} title="When on, the assistant performs actions immediately. When off, it asks for confirmation first.">
              <input
                type="checkbox"
                checked={executeActions}
                onChange={(e) => setExecuteActions(e.target.checked)}
              />
              <span>Auto-execute</span>
            </label>
            <textarea
              ref={inputRef}
              className={styles.input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask the assistant…  (Enter to send, Shift+Enter for newline)"
              rows={2}
              disabled={sending}
            />
            <div className={styles.composerActions}>
              <button
                type="button"
                className={styles.attachBtn}
                onClick={handleAttachClick}
                disabled={sending || uploading}
                title="Attach a Postman / Swagger / HAR file"
              >
                📎 Attach
              </button>
              <button
                type="button"
                className={styles.clearBtn}
                onClick={handleClear}
                disabled={sending || messages.length === 0}
                title="Clear conversation"
              >
                Clear
              </button>
              <button
                type="submit"
                className={styles.sendBtn}
                disabled={
                  sending ||
                  uploading ||
                  (attachedFile
                    ? !importModuleId || !importFlowName.trim()
                    : !input.trim())
                }
              >
                {uploading ? "…" : sending ? "…" : attachedFile ? "Upload" : "Send"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export default ChatBot;
