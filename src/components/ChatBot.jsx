import { useEffect, useRef, useState } from "react";
import { api } from "../utils/api";
import { toast } from "./ui/toast/toast";
import styles from "./ChatBot.module.css";

const STORAGE_KEY = "mr_auto_assistant_history_v1";
const MAX_HISTORY = 20;

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
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => loadHistory());
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [executeActions, setExecuteActions] = useState(false);
  const [pendingConfirmFor, setPendingConfirmFor] = useState(null);
  const [unread, setUnread] = useState(false);
  const scrollerRef = useRef(null);
  const inputRef = useRef(null);

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

      const assistantMsg = {
        role: "assistant",
        content: res?.reply || "(no reply)",
        actions: Array.isArray(res?.actions) ? res.actions : [],
        confirmationRequired: !!res?.confirmationRequired,
        executed: !!(execute ?? executeActions),
        prompt: trimmed,
        ts: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (assistantMsg.confirmationRequired && !assistantMsg.executed) {
        setPendingConfirmFor(trimmed);
      }
      if (!open) setUnread(true);
    } catch (err) {
      const errMsg = {
        role: "assistant",
        content: err?.message || "The assistant request failed.",
        error: true,
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
      toast.error(err?.message || "Assistant request failed");
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
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
                disabled={sending || !input.trim()}
              >
                {sending ? "…" : "Send"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export default ChatBot;
