import { useState } from "react";
import { api } from "../utils/api";
import { useModules } from "../context/CollectionContext";
import Tabs from "./ui/tabs/Tabs";
import Button from "./ui/button/Button";
import styles from "./ResponseViewer.module.css";

const RESPONSE_TABS = [
  { id: "body", label: "Body" },
  { id: "headers", label: "Headers" },
  { id: "request", label: "Request (Resolved)" },
];

function ResponseViewer({ response: propResponse }) {
  const { selectedStep, selectedFlowId } = useModules();
  const response = propResponse || selectedStep?.response;
  const [activeTab, setActiveTab] = useState("body");

  const [copied, setCopied] = useState(false);

  // ... (keep previous functions)
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
      .replace(/("(?:\\.|[^"\\])*")\s*:/g, `<span class="${styles.jsonKey}">$1</span>:`)
      .replace(/:\s*("(?:\\.|[^"\\])*")/g, (_, v) => `: <span class="${styles.jsonString}">${v}</span>`)
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
          {response.status || "—"} {response.statusText || "Pending"}
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
          <Button 
            variant="secondary" 
            size="small" 
            onClick={() => window.open(api.getFlowReport(selectedFlowId), "_blank")}
            title="Download PDF execution report"
          >
            PDF Report
          </Button>
          <Button variant="ghost" size="small" onClick={handleCopy}>
            {copied ? "✓ Copied" : "📋 Copy"}
          </Button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs
        tabs={response.resolvedUrl ? RESPONSE_TABS : RESPONSE_TABS.slice(0, 2)}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* ── Body ── */}
      {activeTab === "body" && (
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
      {activeTab === "headers" && (
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
      {activeTab === "request" && (
        <div className={styles.requestPanel}>
          <div className={styles.requestInfo}>
            <div className={styles.requestMeta}>
              <strong>URL:</strong> <code>{response.resolvedUrl}</code>
            </div>
            {response.resolvedHeaders && (
              <div className={styles.requestHeaders}>
                <strong>Headers:</strong>
                <pre>{JSON.stringify(response.resolvedHeaders, null, 2)}</pre>
              </div>
            )}
            {response.resolvedBody && (
              <div className={styles.requestBody}>
                <strong>Body:</strong>
                <div className={styles.bodyScroll}>
                  <pre dangerouslySetInnerHTML={{ __html: syntaxHighlight(formatJson(response.resolvedBody)) }} />
                </div>
              </div>
            )}
            {!response.resolvedUrl && (
              <div className={styles.headersEmpty}>No resolved request data available.</div>
            )}
          </div>
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
