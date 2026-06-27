import { useState, useMemo, useEffect } from "react";
import { api, openPdfInTab } from "../utils/api";
import { useModules } from "../context/CollectionContext";
import { toast } from "./ui/toast/toast";
import Tabs from "./ui/tabs/Tabs";
import Button from "./ui/button/Button";
import styles from "./ResponseViewer.module.css";

const RESPONSE_TABS = [
  { id: "body", label: "Body" },
  { id: "headers", label: "Headers" },
  { id: "request", label: "Request (Resolved)" },
  { id: "capture", label: "📥 Capture to Env" },
];

async function handleOpenPdf(url) {
  try {
    await openPdfInTab(url);
  } catch (err) {
    toast.error(err?.message || "Failed to open report.");
  }
}

/** Recursively flatten a JSON object to dot-notation paths + primitive values */
function flattenJson(obj, prefix = "", result = {}) {
  if (obj === null || obj === undefined) return result;
  if (typeof obj !== "object" || Array.isArray(obj)) {
    result[prefix] = typeof obj === "object" ? JSON.stringify(obj) : String(obj);
    return result;
  }
  for (const [key, val] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      flattenJson(val, path, result);
    } else {
      result[path] = val === null ? "null" : Array.isArray(val) ? JSON.stringify(val) : String(val);
    }
  }
  return result;
}

function CaptureToEnvPanel({ response, flowId, stepId }) {
  const { selectedModule } = useModules();
  const environments = selectedModule?.environments || [];

  // Parse response body and flatten to field paths
  const fields = useMemo(() => {
    if (!response?.body) return {};
    try {
      const parsed = JSON.parse(response.body);
      return flattenJson(parsed);
    } catch {
      return {};
    }
  }, [response?.body]);

  const fieldPaths = Object.keys(fields);

  // Mapping state: { [field]: { selected: bool, envVarName: string } }
  const [mappings, setMappings] = useState(() => {
    const m = {};
    Object.keys(fields).forEach(f => { m[f] = { selected: false, envVarName: f.replace(/\./g, "_") }; });
    return m;
  });
  const [fieldSearch, setFieldSearch] = useState("");

  useEffect(() => {
    setMappings(prev => {
      const next = {};
      fieldPaths.forEach(field => {
        next[field] = prev[field] || {
          selected: false,
          envVarName: field.replace(/\./g, "_"),
        };
      });
      return next;
    });
  }, [fieldPaths.join("|")]);

  const [selectedEnvId, setSelectedEnvId] = useState(() => environments[0]?.id || "");
  const [saving, setSaving] = useState(false);

  const normalizedSearch = fieldSearch.trim().toLowerCase();
  const visibleFieldPaths = normalizedSearch
    ? fieldPaths.filter(field => {
        const value = fields[field] !== undefined ? String(fields[field]) : "";
        return (
          field.toLowerCase().includes(normalizedSearch) ||
          value.toLowerCase().includes(normalizedSearch) ||
          (mappings[field]?.envVarName || "").toLowerCase().includes(normalizedSearch)
        );
      })
    : fieldPaths;
  const selectedCount = fieldPaths.filter(f => mappings[f]?.selected).length;
  const visibleSelectedCount = visibleFieldPaths.filter(f => mappings[f]?.selected).length;

  function toggleField(field) {
    setMappings(prev => ({
      ...prev,
      [field]: { ...prev[field], selected: !prev[field]?.selected, envVarName: prev[field]?.envVarName || field.replace(/\./g, "_") }
    }));
  }

  function setEnvVarName(field, name) {
    setMappings(prev => ({
      ...prev,
      [field]: { ...prev[field], envVarName: name }
    }));
  }

  function selectAll() {
    const next = {};
    visibleFieldPaths.forEach(f => { next[f] = { ...mappings[f], selected: true, envVarName: mappings[f]?.envVarName || f.replace(/\./g, "_") }; });
    setMappings(prev => ({ ...prev, ...next }));
  }

  function clearAll() {
    const next = {};
    visibleFieldPaths.forEach(f => { next[f] = { ...mappings[f], selected: false, envVarName: mappings[f]?.envVarName || f.replace(/\./g, "_") }; });
    setMappings(prev => ({ ...prev, ...next }));
  }

  async function handleCapture() {
    if (!selectedEnvId) { toast.error("Select an environment first."); return; }
    if (selectedCount === 0) { toast.error("Select at least one field to capture."); return; }
    if (!flowId || !stepId) { toast.error("Run the step first to capture its response."); return; }

    const captured = fieldPaths
      .filter(f => mappings[f]?.selected)
      .map(f => ({
        field: f,
        envVarName: (mappings[f]?.envVarName || f.replace(/\./g, "_")).trim() || f.replace(/\./g, "_"),
      }));

    setSaving(true);
    try {
      await api.captureToEnv(flowId, stepId, parseInt(selectedEnvId), captured);
      const envName = environments.find(e => e.id == selectedEnvId)?.name || "env";
      toast.success(`${captured.length} field${captured.length > 1 ? "s" : ""} captured to "${envName}"`);
    } catch (err) {
      toast.error("Capture failed: " + (err.message || err));
    } finally {
      setSaving(false);
    }
  }

  if (fieldPaths.length === 0) {
    return (
      <div style={{ padding: "24px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", color: "var(--text-muted)", textAlign: "center" }}>
        <span style={{ fontSize: "32px" }}>📭</span>
        <p style={{ fontSize: "14px", margin: 0 }}>No JSON fields available. Run the step to get a response, or the response is not JSON.</p>
      </div>
    );
  }

  return (
    <div className={styles.capturePanel}>
      {/* Header controls */}
      <div className={styles.captureControls}>
        <div className={styles.captureControlGroup}>
          <label className={styles.captureLabel}>
            Save to Environment
          </label>
          {environments.length === 0 ? (
            <div style={{ fontSize: "12px", color: "var(--status-warning, #f59e0b)", padding: "8px 12px", borderRadius: "8px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
              ⚠️ No environments found. Create one in the Environment manager first.
            </div>
          ) : (
            <select
              value={selectedEnvId}
              onChange={e => setSelectedEnvId(e.target.value)}
              className={styles.captureSelect}
            >
              <option value="">— Select environment —</option>
              {environments.map(env => (
                <option key={env.id} value={env.id}>{env.name}</option>
              ))}
            </select>
          )}
        </div>

        <div className={styles.captureControlGroup}>
          <label className={styles.captureLabel}>
            Search Fields
          </label>
          <input
            type="search"
            value={fieldSearch}
            onChange={(e) => setFieldSearch(e.target.value)}
            placeholder="Search path, value, or env name"
            className={styles.captureSearch}
          />
        </div>

        <div className={styles.captureActions}>
          <button type="button" onClick={selectAll} className={styles.captureActionBtn} disabled={visibleFieldPaths.length === 0}>
            Select {normalizedSearch ? "Filtered" : "All"}
          </button>
          <button type="button" onClick={clearAll} className={`${styles.captureActionBtn} ${styles.captureActionMuted}`} disabled={visibleSelectedCount === 0}>
            Clear
          </button>
        </div>
      </div>

      <div className={styles.captureSummary}>
        <span>{selectedCount} selected</span>
        <span>{visibleFieldPaths.length} of {fieldPaths.length} fields shown</span>
      </div>

      {/* Fields table */}
      <div className={styles.captureTableWrap}>
        {/* Table header */}
        <div className={styles.captureHeader}>
          <span className={styles.captureSelectHeader}>Select</span>
          <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>JSON Path</span>
          <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Current Value</span>
          <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Env Var Name</span>
        </div>

        {/* Rows */}
        <div className={styles.captureRows}>
          {visibleFieldPaths.length === 0 && (
            <div className={styles.captureEmpty}>No fields match your search.</div>
          )}
          {visibleFieldPaths.map((field, idx) => {
            const m = mappings[field] || { selected: false, envVarName: field.replace(/\./g, "_") };
            const rawVal = fields[field];
            const displayVal = rawVal !== undefined ? String(rawVal) : "";
            const truncated = displayVal.length > 40 ? displayVal.slice(0, 40) + "…" : displayVal;

            return (
              <div
                key={field}
                onClick={() => toggleField(field)}
                className={styles.captureRow}
                style={{
                  borderBottom: idx < visibleFieldPaths.length - 1 ? "1px solid var(--border-color)" : "none",
                  background: m.selected ? "rgba(16,185,129,0.05)" : "transparent",
                }}
                onMouseEnter={e => { if (!m.selected) e.currentTarget.style.background = "var(--bg-tertiary, rgba(255,255,255,0.03))"; }}
                onMouseLeave={e => { e.currentTarget.style.background = m.selected ? "rgba(16,185,129,0.05)" : "transparent"; }}
              >
                {/* Checkbox */}
                <label className={styles.captureCheckboxCell} onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={!!m.selected}
                    onChange={() => toggleField(field)}
                    aria-label={`Select ${field}`}
                  />
                </label>

                {/* JSON Path */}
                <code style={{ fontSize: "12px", color: "var(--text-primary)", fontFamily: "monospace", wordBreak: "break-all" }}>{field}</code>

                {/* Value preview */}
                <span style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={displayVal}>
                  {truncated || <em>empty</em>}
                </span>

                {/* Env var name input */}
                <input
                  type="text"
                  value={m.envVarName || ""}
                  onClick={e => e.stopPropagation()}
                  onChange={e => { e.stopPropagation(); setEnvVarName(field, e.target.value); }}
                  disabled={!m.selected}
                  placeholder={field.replace(/\./g, "_")}
                  style={{
                    width: "100%", padding: "5px 8px", borderRadius: "6px",
                    border: "1px solid var(--border-color)",
                    background: m.selected ? "var(--bg-secondary)" : "var(--bg-tertiary, rgba(255,255,255,0.02))",
                    color: m.selected ? "var(--text-primary)" : "var(--text-muted)",
                    fontSize: "11px", fontFamily: "monospace",
                    opacity: m.selected ? 1 : 0.5, boxSizing: "border-box",
                    cursor: m.selected ? "text" : "default",
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Save button */}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "12px" }}>
        {selectedCount > 0 && (
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {selectedCount} field{selectedCount > 1 ? "s" : ""} selected
          </span>
        )}
        <Button
          onClick={handleCapture}
          disabled={saving || selectedCount === 0 || !selectedEnvId}
        >
          {saving ? "Saving…" : `📥 Capture ${selectedCount > 0 ? selectedCount + " " : ""}Field${selectedCount !== 1 ? "s" : ""} to Env`}
        </Button>
      </div>
    </div>
  );
}

function ResponseViewer({ response: propResponse }) {
  const { selectedStep, selectedFlowId, selectedStepId } = useModules();
  const response = propResponse || selectedStep?.response;
  const [activeTab, setActiveTab] = useState("body");

  const [copied, setCopied] = useState(false);

  function formatSize(bytes) {
    if (!bytes) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  function formatTime(ms) {
    if (!ms && ms !== 0) return "—";
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
  }

  function handleCopy() {
    const text = activeTab === "request"
      ? (response?.resolvedBody || "")
      : (response?.body || "");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function formatJson(str) {
    if (!str) return "";
    try {
      const obj = typeof str === 'string' ? JSON.parse(str) : str;
      return JSON.stringify(obj, null, 2);
    } catch {
      return str;
    }
  }

  function syntaxHighlight(json) {
    if (!json) return "";
    return json
      .replace(/(\"(?:\\.|[^\"\\])*\")\s*:/g, `<span class="${styles.jsonKey}">$1</span>:`)
      .replace(/:\s*(\"(?:\\.|[^\"\\])*\")/g, (_, v) => `: <span class="${styles.jsonString}">${v}</span>`)
      .replace(/:\s*(-?\d+\.?\d*([eE][+-]?\d+)?)\b/g, (_, v) => `: <span class="${styles.jsonNumber}">${v}</span>`)
      .replace(/:\s*(true|false)\b/g, (_, v) => `: <span class="${styles.jsonBool}">${v}</span>`)
      .replace(/:\s*(null)\b/g, (_, v) => `: <span class="${styles.jsonNull}">${v}</span>`);
  }

  function isJsonResponse(resp) {
    const ct = (resp?.headers || []).find(
      h => h.key?.toLowerCase() === "content-type"
    )?.value || "";
    if (ct.includes("json")) return true;
    try { JSON.parse(resp?.body); return true; } catch { return false; }
  }

  function getContentTypeLabel(resp) {
    const ct = (resp?.headers || []).find(
      h => h.key?.toLowerCase() === "content-type"
    )?.value || "";
    if (ct.includes("json")) return "JSON";
    if (ct.includes("html")) return "HTML";
    if (ct.includes("xml")) return "XML";
    if (ct.includes("text")) return "Text";
    return "Raw";
  }

  // ── No response yet ──
  if (!response) {
    return (
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Response</span>
        </div>
        <div className={styles.awaiting}>
          <div className={styles.awaitingIcon}>📡</div>
          <div className={styles.awaitingText}>
            Hit <strong>Send</strong> or <strong>Run Flow</strong> to see results
          </div>
        </div>
      </div>
    );
  }

  const statusClass = getStatusClass(response.status);
  const isJson = isJsonResponse(response);
  const formatted = formatJson(response.body || "");
  const lineCount = formatted.split("\n").length;
  const contentTypeLabel = getContentTypeLabel(response);
  const canOpenPdfReport = !!response.isFromFlowRun && !!selectedFlowId;

  const isNetworkOrExceptionError = response.status === 0 || response.status === null || response.status === undefined;
  const hasLongError = isNetworkOrExceptionError && response.statusText && response.statusText.length > 30;

  // Show capture tab only if we have a JSON body and a step context
  const showCaptureTab = isJson && !!selectedStepId;
  const visibleTabs = showCaptureTab
    ? (response.resolvedUrl ? RESPONSE_TABS : RESPONSE_TABS.filter(t => t.id !== "request"))
    : (response.resolvedUrl ? RESPONSE_TABS.filter(t => t.id !== "capture") : RESPONSE_TABS.filter(t => t.id !== "request" && t.id !== "capture"));

  const effectiveTab = visibleTabs.some(t => t.id === activeTab) ? activeTab : visibleTabs[0]?.id || "body";

  return (
    <div className={styles.section}>
      {/* Section heading */}
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Execution Result</span>
      </div>

      {/* ── Status Bar ── */}
      <div className={styles.statusBar}>
        <span className={`${styles.statusBadge} ${statusClass}`}>
          <span className={styles.statusDot} />
          {response.status || "—"} {hasLongError ? "EXECUTION EXCEPTION" : (response.statusText || "Pending")}
        </span>

        <div className={styles.divider} />

        <div className={styles.statPill}>
          <span className={styles.statIcon}>⏱</span>
          <span className={styles.statValue}>{formatTime(response.time)}</span>
        </div>

        {response.size > 0 && (
          <>
            <div className={styles.divider} />
            <div className={styles.statPill}>
              <span className={styles.statIcon}>📦</span>
              <span className={styles.statValue}>{formatSize(response.size)}</span>
            </div>
          </>
        )}

        <div className={styles.statusBarRight}>
          {canOpenPdfReport && (
            <Button
              variant="secondary"
              size="small"
              onClick={() => handleOpenPdf(api.getFlowReport(selectedFlowId))}
              title="Open PDF execution report in new tab"
            >
              📄 PDF Report
            </Button>
          )}
          <Button variant="ghost" size="small" onClick={handleCopy}>
            {copied ? "✓ Copied" : "📋 Copy"}
          </Button>
        </div>
      </div>

      {hasLongError && (
        <div className={styles.errorAlert}>
          <span className={styles.errorAlertIcon}>⚠️</span>
          <div className={styles.errorAlertContent}>
            <strong>Execution Exception Details:</strong>
            <div className={styles.errorAlertText}>{response.statusText}</div>
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <Tabs tabs={visibleTabs} activeTab={effectiveTab} onChange={setActiveTab} />

      {/* ── Body ── */}
      {effectiveTab === "body" && (
        <div className={styles.bodyPanel}>
          <div className={styles.bodyToolbar}>
            <div className={styles.bodyToolbarLeft}>
              <span className={styles.contentTypeTag}>{contentTypeLabel}</span>
              <span className={styles.lineCountTag}>{lineCount} lines</span>
            </div>
          </div>
          <div className={styles.bodyScroll}>
            {isJson ? (
              <pre dangerouslySetInnerHTML={{ __html: syntaxHighlight(formatted) }} />
            ) : (
              <pre>{formatted}</pre>
            )}
          </div>
        </div>
      )}

      {/* ── Response Headers ── */}
      {effectiveTab === "headers" && (
        <div className={styles.headersPanel}>
          {(!response.headers || response.headers.length === 0) ? (
            <div className={styles.headersEmpty}>No response headers returned from engine</div>
          ) : (
            response.headers.map((h, i) => (
              <div key={i} className={styles.headerRow}>
                <span className={styles.headerKey}>{h.key}</span>
                <span className={styles.headerValue}>{h.value}</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Resolved Request ── */}
      {effectiveTab === "request" && (
        <div className={styles.requestPanel}>
          <div className={styles.requestInfo}>
            {response.resolvedUrl && (
              <div className={styles.requestMeta}>
                <strong>Request URL</strong>
                <code>{response.resolvedUrl}</code>
              </div>
            )}
            {response.resolvedHeaders && (
              <div className={styles.requestHeaders}>
                <strong>Request Headers</strong>
                <pre dangerouslySetInnerHTML={{
                  __html: syntaxHighlight(JSON.stringify(response.resolvedHeaders, null, 2))
                }} />
              </div>
            )}
            {response.resolvedBody && (
              <div className={styles.requestBody}>
                <strong>Request Body</strong>
                <pre dangerouslySetInnerHTML={{
                  __html: syntaxHighlight(
                    typeof response.resolvedBody === "string"
                      ? formatJson(response.resolvedBody)
                      : JSON.stringify(response.resolvedBody, null, 2)
                  )
                }} />
              </div>
            )}
            {!response.resolvedUrl && (
              <div className={styles.headersEmpty}>No resolved request data available.</div>
            )}
          </div>
        </div>
      )}

      {/* ── Capture to Env ── */}
      {effectiveTab === "capture" && (
        <div className={styles.bodyPanel} style={{ padding: "12px 0 0" }}>
          <CaptureToEnvPanel
            response={response}
            flowId={selectedFlowId}
            stepId={selectedStepId}
          />
        </div>
      )}
    </div>
  );
}

function getStatusClass(status) {
  if (!status || status === 0) return styles.status0;
  if (status >= 200 && status < 300) return styles.status2xx;
  if (status >= 300 && status < 400) return styles.status3xx;
  if (status >= 400 && status < 500) return styles.status4xx;
  return styles.status5xx;
}

export default ResponseViewer;
