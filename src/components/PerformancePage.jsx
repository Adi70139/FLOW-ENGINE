import { useState, useEffect, useRef } from "react";
import { performanceApi } from "../utils/performanceApi";
import { parseCurl } from "../utils/parseCurl";
import Button from "./ui/button/Button";
import Input from "./ui/input/Input";
import Textarea from "./ui/textarea/Textarea";
import { toast } from "./ui/toast/toast";
import styles from "./PerformancePage.module.css";

const INITIAL_FORM = {
  name: "Performance Run",
  url: "http://localhost:8070",
  method: "GET",
  headers: "{\n  \"Accept\": \"application/json\"\n}",
  body: "",
  description: "",
  payloadListStr: "",
  testType: "LOAD",
  virtualUsers: 5,
  durationSeconds: 15,
  stressRampStep: 2,
  stressRampIntervalSeconds: 3,
  spikeUsers: 15,
  spikeDurationSeconds: 4,
  warmupSeconds: 2,
  cooldownSeconds: 2,
  soakDurationSeconds: 30,
};

export default function PerformancePage() {
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedRun, setSelectedRun] = useState(null);

  // Saved APIs state
  const [savedApis, setSavedApis] = useState([]);
  const [loadingApis, setLoadingApis] = useState(false);
  const [selectedApi, setSelectedApi] = useState(null);
  const [viewMode, setViewMode] = useState("apis"); // "apis" or "history"

  // Sidebar state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Form fields
  const [form, setForm] = useState(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // cURL import toggle and string
  const [showCurlInput, setShowCurlInput] = useState(false);
  const [curlString, setCurlString] = useState("");

  // Live test states
  const [activeRunId, setActiveRunId] = useState(null);
  const [liveStats, setLiveStats] = useState(null);
  const [logLines, setLogLines] = useState([]);
  const [samples, setSamples] = useState([]);
  const [rating, setRating] = useState(null);

  const sseRef = useRef(null);
  const logsTerminalRef = useRef(null);

  // Load history & apis on mount
  useEffect(() => {
    fetchHistory();
    fetchApis();
    return () => {
      if (sseRef.current && typeof sseRef.current.close === "function") {
        sseRef.current.close();
      }
    };
  }, []);

  // Auto-scroll logs terminal
  useEffect(() => {
    if (logsTerminalRef.current) {
      logsTerminalRef.current.scrollTop = logsTerminalRef.current.scrollHeight;
    }
  }, [logLines]);

  async function fetchHistory() {
    setLoadingHistory(true);
    try {
      const data = await performanceApi.getHistory();
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error("Failed to load history: " + err.message);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function fetchApis() {
    setLoadingApis(true);
    try {
      const data = await performanceApi.listApis();
      setSavedApis(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error("Failed to load saved APIs: " + err.message);
    } finally {
      setLoadingApis(false);
    }
  }

  async function handleSelectRun(run) {
    setSelectedRun(run);
    setActiveRunId(null);
    setLiveStats(run);
    setRating(null);
    setSamples([]);

    // Stop any active SSE
    if (sseRef.current && typeof sseRef.current.close === "function") {
      sseRef.current.close();
      sseRef.current = null;
    }

    // Pre-fill the form with the selected run's configuration
    let hdrsStr = "{}";
    if (run.resolvedHeadersJson) {
      try {
        hdrsStr = JSON.stringify(JSON.parse(run.resolvedHeadersJson), null, 2);
      } catch {
        hdrsStr = run.resolvedHeadersJson;
      }
    } else if (run.headers) {
      try {
        hdrsStr = JSON.stringify(run.headers, null, 2);
      } catch {
        hdrsStr = "{}";
      }
    }

    let payloadStr = "";
    if (run.payloadListJson) {
      try {
        const arr = JSON.parse(run.payloadListJson);
        payloadStr = Array.isArray(arr) ? arr.join("\n") : "";
      } catch {
        payloadStr = run.payloadListJson;
      }
    }

    setForm({
      name: run.name || "Performance Run",
      url: run.resolvedUrl || run.url || "",
      method: run.resolvedMethod || run.method || "GET",
      headers: hdrsStr,
      body: run.resolvedBodyJson || run.body || "",
      description: "",
      payloadListStr: payloadStr,
      testType: run.testType || "LOAD",
      virtualUsers: run.virtualUsers || 5,
      durationSeconds: run.durationSeconds || 15,
      stressRampStep: run.stressRampStep || 2,
      stressRampIntervalSeconds: run.stressRampIntervalSeconds || 3,
      spikeUsers: run.spikeUsers || 15,
      spikeDurationSeconds: run.spikeDurationSeconds || 4,
      warmupSeconds: run.warmupSeconds || 2,
      cooldownSeconds: run.cooldownSeconds || 2,
      soakDurationSeconds: run.soakDurationSeconds || 30,
    });

    try {
      // Load samples
      const sampleData = await performanceApi.getSamples(run.id);
      setSamples(Array.isArray(sampleData) ? sampleData : []);

      // Load rating if status is COMPLETED or done
      if (run.status === "COMPLETED" || run.status === "SUCCESS") {
        const ratingData = await performanceApi.rate(run.id);
        setRating(ratingData);
      }
    } catch (err) {
      console.error("Failed to load run details:", err);
    }
  }

  function handleSelectApi(api) {
    setSelectedApi(api);
    
    let hdrsStr = "{}";
    if (api.headersJson) {
      try {
        hdrsStr = JSON.stringify(JSON.parse(api.headersJson), null, 2);
      } catch {
        hdrsStr = api.headersJson;
      }
    }

    let payloadStr = "";
    if (api.payloadListJson) {
      try {
        const arr = JSON.parse(api.payloadListJson);
        payloadStr = Array.isArray(arr) ? arr.join("\n") : "";
      } catch {
        payloadStr = api.payloadListJson;
      }
    }

    setForm((prev) => ({
      ...prev,
      name: api.name || "Performance Run",
      url: api.url || "",
      method: api.method || "GET",
      headers: hdrsStr,
      body: api.bodyJson || api.body || "",
      description: api.description || "",
      payloadListStr: payloadStr,
    }));
  }

  function handleClearForm() {
    setSelectedApi(null);
    setForm(INITIAL_FORM);
  }

  async function handleSaveApi(e) {
    e.preventDefault();
    
    // Parse headers
    let parsedHeaders = {};
    try {
      if (form.headers.trim()) {
        parsedHeaders = JSON.parse(form.headers);
      }
    } catch (err) {
      toast.error("Invalid headers JSON: " + err.message);
      return;
    }

    const payloadList = form.payloadListStr
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const apiPayload = {
      name: form.name,
      description: form.description,
      url: form.url,
      method: form.method,
      headers: parsedHeaders,
      body: form.body || null,
      payloadList: payloadList,
    };

    try {
      if (selectedApi) {
        const updated = await performanceApi.updateApi(selectedApi.id, apiPayload);
        toast.success("API configuration updated successfully!");
        fetchApis();
        if (updated) setSelectedApi(updated);
      } else {
        const created = await performanceApi.createApi(apiPayload);
        toast.success("API configuration saved successfully!");
        fetchApis();
        if (created) setSelectedApi(created);
      }
    } catch (err) {
      toast.error("Failed to save API: " + err.message);
    }
  }

  async function handleDeleteApi(apiId) {
    if (!window.confirm("Are you sure you want to delete this API config?")) return;
    try {
      await performanceApi.deleteApi(apiId);
      toast.success("API configuration deleted successfully!");
      handleClearForm();
      fetchApis();
    } catch (err) {
      toast.error("Failed to delete API: " + err.message);
    }
  }

  function handleInputChange(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  // Handle importing a cURL command
  function handleImportCurl() {
    if (!curlString.trim()) {
      toast.error("Please paste a cURL command first.");
      return;
    }
    const parsed = parseCurl(curlString);
    if (!parsed.url) {
      toast.error("Could not parse a valid URL from the cURL command.");
      return;
    }

    // Convert parsed headers array to object for the JSON editor
    const headersObj = {};
    if (Array.isArray(parsed.headers)) {
      parsed.headers.forEach((h) => {
        if (h.key && h.enabled) {
          headersObj[h.key] = h.value;
        }
      });
    }

    setForm((prev) => ({
      ...prev,
      url: parsed.url,
      method: parsed.method,
      body: parsed.data || "",
      headers: JSON.stringify(headersObj, null, 2),
    }));

    toast.success("cURL command parsed successfully!");
    setCurlString("");
    setShowCurlInput(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (isSubmitting || activeRunId) return;

    setIsSubmitting(true);
    setLogLines(["Starting performance test..."]);
    setSamples([]);
    setRating(null);
    setLiveStats(null);

    // Parse headers
    let parsedHeaders = {};
    try {
      if (form.headers.trim()) {
        parsedHeaders = JSON.parse(form.headers);
      }
    } catch (err) {
      toast.error("Invalid headers JSON: " + err.message);
      setIsSubmitting(false);
      return;
    }

    const payload = {
      apiId: selectedApi?.id || null,
      name: form.name,
      url: form.url,
      method: form.method,
      headers: parsedHeaders,
      body: form.body || null,
      payloadList: form.payloadListStr
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
      testType: form.testType,
      virtualUsers: parseInt(form.virtualUsers) || 1,
      durationSeconds: parseInt(form.durationSeconds) || 5,
      stressRampStep: parseInt(form.stressRampStep) || 0,
      stressRampIntervalSeconds: parseInt(form.stressRampIntervalSeconds) || 0,
      spikeUsers: parseInt(form.spikeUsers) || 0,
      spikeDurationSeconds: parseInt(form.spikeDurationSeconds) || 0,
      warmupSeconds: parseInt(form.warmupSeconds) || 0,
      cooldownSeconds: parseInt(form.cooldownSeconds) || 0,
      soakDurationSeconds: parseInt(form.soakDurationSeconds) || 0,
    };

    try {
      const run = await performanceApi.start(payload);
      if (run && run.id) {
        setActiveRunId(run.id);
        setLiveStats(run);
        toast.success(`Started performance test run: ${run.id}`);
        setupSse(run.id);
      }
    } catch (err) {
      toast.error("Failed to run test: " + err.message);
      setLogLines((prev) => [...prev, `[ERROR] ${err.message}`]);
    } finally {
      setIsSubmitting(false);
    }
  }

  function setupSse(runId) {
    if (sseRef.current && typeof sseRef.current.close === "function") {
      sseRef.current.close();
    }

    const url = performanceApi.getStreamUrl(runId);
    const token = performanceApi.getAuthToken();
    const controller = new AbortController();
    const { signal } = controller;

    sseRef.current = {
      close: () => controller.abort()
    };

    const addLog = (type, message) => {
      const time = new Date().toLocaleTimeString();
      setLogLines((prev) => [...prev, `[${time}] [${type.toUpperCase()}] ${message}`]);
    };

    const headers = {
      "Accept": "text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    fetch(url, { headers, signal })
      .then(async (response) => {
        if (!response.ok) {
          addLog("error", `Forbidden or Error: ${response.status}`);
          setActiveRunId(null);
          fetchHistory();
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const messages = buffer.split("\n\n");
          buffer = messages.pop();

          for (const msg of messages) {
            if (!msg.trim()) continue;

            let event = "message";
            let data = "";

            const lines = msg.split("\n");
            for (const line of lines) {
              if (line.startsWith("event:")) {
                event = line.replace("event:", "").trim();
              } else if (line.startsWith("data:")) {
                data = line.replace("data:", "").trim();
              }
            }

            if (event === "status") {
              addLog("status", data);
            } else if (event === "progress") {
              try {
                const stats = JSON.parse(data);
                setLiveStats((prev) => ({ ...prev, ...stats }));
                addLog("progress", `RPS: ${stats.throughputRps?.toFixed(1) || 0} | Latency: ${stats.avgLatencyMs?.toFixed(1) || 0}ms | Errors: ${stats.failedRequests || 0}`);
              } catch {
                addLog("progress", data);
              }
            } else if (event === "ramp") {
              addLog("ramp", data);
            } else if (event === "phase") {
              addLog("phase", data);
            } else if (event === "breaking_point") {
              addLog("breaking", `Stress breaking point identified: ${data}`);
            } else if (event === "window_stats") {
              try {
                const win = JSON.parse(data);
                addLog("window", `Window Avg Latency: ${win.avgLatencyMs?.toFixed(1)}ms | RPS: ${win.throughputRps?.toFixed(1)}`);
              } catch {
                addLog("window", data);
              }
            } else if (event === "completed") {
              addLog("completed", "Test finished! Retrieving final reports.");
              controller.abort();
              setActiveRunId(null);
              fetchHistory();
              try {
                const finalRun = await performanceApi.getResult(runId);
                setSelectedRun(finalRun);
                setLiveStats(finalRun);
                const sampleData = await performanceApi.getSamples(runId);
                setSamples(Array.isArray(sampleData) ? sampleData : []);
                const ratingData = await performanceApi.rate(runId);
                setRating(ratingData);
              } catch (err) {
                console.error("Failed to load completed report info:", err);
              }
            } else if (event === "error") {
              addLog("error", data || "Error event received from server.");
              controller.abort();
              setActiveRunId(null);
              fetchHistory();
            }
          }
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          addLog("error", "Stream error: " + err.message);
          setActiveRunId(null);
          fetchHistory();
        }
      });
  }

  async function handleCancel() {
    if (!activeRunId) return;
    try {
      await performanceApi.cancel(activeRunId);
      toast.success("Cancellation request sent.");
      setLogLines((prev) => [...prev, "Cancelling run... preserving collected metrics."]);
    } catch (err) {
      toast.error("Failed to cancel test: " + err.message);
    }
  }

  // Visual SVG chart renderer
  function renderChart() {
    if (!samples || samples.length === 0) {
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)" }}>
          Run a test or select a finished run to view the latency timeline chart.
        </div>
      );
    }

    // Filter and sort samples
    const sortedSamples = [...samples].sort((a, b) => new Date(a.firedAt) - new Date(b.firedAt));
    const maxVal = Math.max(...sortedSamples.map((s) => s.latencyMs), 100);
    const minVal = Math.min(...sortedSamples.map((s) => s.latencyMs), 0);

    const width = 800;
    const height = 200;
    const paddingLeft = 50;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    // Map to coordinates
    const points = sortedSamples.map((sample, idx) => {
      const x = paddingLeft + (idx / (sortedSamples.length - 1 || 1)) * chartWidth;
      const y = paddingTop + chartHeight - ((sample.latencyMs - minVal) / (maxVal - minVal || 1)) * chartHeight;
      return { x, y, sample };
    });

    let pathD = "";
    let areaD = "";
    if (points.length > 0) {
      pathD = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ");
      areaD = pathD + ` L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`;
    }

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className={styles.chartSvg}>
        {/* Y Axis Guide Lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = paddingTop + chartHeight * (1 - ratio);
          const val = Math.round(minVal + (maxVal - minVal) * ratio);
          return (
            <g key={ratio}>
              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="var(--border)" strokeDasharray="3 3" />
              <text x={paddingLeft - 8} y={y + 4} textAnchor="end" fontSize="10" fill="var(--text-muted)">{val}ms</text>
            </g>
          );
        })}

        {/* Path and Area */}
        {points.length > 1 && (
          <>
            <path d={areaD} fill="rgba(16, 185, 129, 0.05)" />
            <path d={pathD} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}

        {/* Individual points for errors */}
        {points.map((p, i) => {
          if (!p.sample.success) {
            return (
              <circle key={i} cx={p.x} cy={p.y} r="4" fill="var(--status-error)" />
            );
          }
          return null;
        })}

        {/* X Axis line */}
        <line x1={paddingLeft} y1={paddingTop + chartHeight} x2={width - paddingRight} y2={paddingTop + chartHeight} stroke="var(--border)" />
        <text x={paddingLeft} y={height - 8} fontSize="10" fill="var(--text-muted)">Start</text>
        <text x={width - paddingRight} y={height - 8} textAnchor="end" fontSize="10" fill="var(--text-muted)">End</text>
      </svg>
    );
  }

  // Get status badge class
  function getBadgeClass(status) {
    const s = String(status || "").toUpperCase();
    if (s === "COMPLETED" || s === "SUCCESS") return styles.badgeSuccess;
    if (s === "RUNNING" || s === "STARTED") return styles.badgeInfo;
    if (s === "CANCELLED" || s === "FAILED") return styles.badgeDanger;
    return styles.badgeWarning;
  }

  return (
    <div className={styles.container}>
      {/* Collapsible Left Sidebar for Saved APIs or Run History */}
      <div className={`${styles.sidebar} ${isSidebarCollapsed ? styles.sidebarCollapsed : ""}`}>
        {isSidebarCollapsed ? (
          <div className={styles.sidebarCollapsedContent}>
            <button
              type="button"
              className={styles.sidebarExpandAction}
              onClick={() => setIsSidebarCollapsed(false)}
              title="Expand Sidebar"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="13 17 18 12 13 7" />
                <polyline points="6 17 11 12 6 7" />
              </svg>
            </button>
            <button
              type="button"
              className={styles.sidebarExpandAction}
              onClick={() => setViewMode(viewMode === "apis" ? "history" : "apis")}
              title={viewMode === "apis" ? "Switch to Run History" : "Switch to Saved APIs"}
            >
              {viewMode === "apis" ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              )}
            </button>
            <div className={styles.collapsedRotatedText}>
              {viewMode === "apis" ? "SAVED APIS" : "RUN HISTORY"}
            </div>
            <Button
              variant="secondary"
              size="small"
              onClick={viewMode === "apis" ? fetchApis : fetchHistory}
              disabled={viewMode === "apis" ? loadingApis : loadingHistory}
              title="Refresh"
              style={{ padding: "4px 8px" }}
            >
              🔄
            </Button>
          </div>
        ) : (
          <div className={styles.sidebarContent}>
            <div className={styles.sidebarHeader}>
              <h3 style={{ margin: 0 }}>{viewMode === "apis" ? "Saved APIs" : "Run History"}</h3>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={viewMode === "apis" ? fetchApis : fetchHistory}
                  disabled={viewMode === "apis" ? loadingApis : loadingHistory}
                >
                  Refresh
                </Button>
                {/* Clock / History / API Icon Toggle */}
                <button
                  type="button"
                  className={styles.sidebarCollapseAction}
                  onClick={() => setViewMode(viewMode === "apis" ? "history" : "apis")}
                  title={viewMode === "apis" ? "Show Run History" : "Show Saved APIs"}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}
                >
                  {viewMode === "apis" ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" title="Show History">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" title="Show Saved APIs">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  className={styles.sidebarCollapseAction}
                  onClick={() => setIsSidebarCollapsed(true)}
                  title="Collapse Sidebar"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="11 17 6 12 11 7" />
                    <polyline points="18 17 13 12 18 7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* List based on viewMode */}
            {viewMode === "apis" ? (
              <div className={styles.historyList}>
                {loadingApis && <div style={{ textAlign: "center", padding: "20px" }}>Loading APIs...</div>}
                {!loadingApis && savedApis.length === 0 && (
                  <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px" }}>
                    No saved API configs found. Create and save one!
                  </div>
                )}
                {!loadingApis && savedApis.map((api) => (
                  <div
                    key={api.id}
                    className={`${styles.historyItem} ${selectedApi?.id === api.id ? styles.historyItemActive : ""}`}
                    onClick={() => handleSelectApi(api)}
                  >
                    <div className={styles.historyHeader}>
                      <span style={{ fontWeight: "600", fontSize: "0.95rem" }}>{api.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteApi(api.id);
                        }}
                        style={{ background: "transparent", border: "none", color: "var(--status-error, #ef4444)", cursor: "pointer", fontSize: "0.9rem" }}
                        title="Delete saved config"
                      >
                        🗑️
                      </button>
                    </div>
                    {api.description && (
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 4 }}>
                        {api.description}
                      </div>
                    )}
                    <div className={styles.historyUrl}>{api.method} {api.url}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.historyList}>
                {loadingHistory && <div style={{ textAlign: "center", padding: "20px" }}>Loading runs...</div>}
                {!loadingHistory && history.length === 0 && (
                  <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px" }}>
                    No performance test runs found.
                  </div>
                )}
                {!loadingHistory && history.map((run) => (
                  <div
                    key={run.id}
                    className={`${styles.historyItem} ${selectedRun?.id === run.id ? styles.historyItemActive : ""}`}
                    onClick={() => handleSelectRun(run)}
                  >
                    <div className={styles.historyHeader}>
                      <span>{run.name || `Run #${run.id}`}</span>
                      <span className={`${styles.badge} ${getBadgeClass(run.status)}`}>
                        {run.status}
                      </span>
                    </div>
                    <div className={styles.historyUrl}>{run.resolvedMethod} {run.resolvedUrl}</div>
                    <div className={styles.historyMeta}>
                      <span>VUs: {run.virtualUsers}</span>
                      <span>{run.startedAt ? new Date(run.startedAt).toLocaleString() : ""}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className={styles.mainContent}>
        {/* Left Side: Configuration Card */}
        <div className={styles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h2 className={styles.cardTitle} style={{ marginBottom: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M21 12H3" />
              </svg>
              Performance Tester
            </h2>
            <div style={{ display: "flex", gap: "6px" }}>
              {selectedApi && (
                <Button variant="secondary" size="small" onClick={handleClearForm}>
                  New / Clear
                </Button>
              )}
              <Button
                variant="secondary"
                size="small"
                onClick={() => setShowCurlInput((prev) => !prev)}
              >
                {showCurlInput ? "Show Config" : "Import cURL"}
              </Button>
            </div>
          </div>

          {showCurlInput ? (
            <div className={styles.form} style={{ marginBottom: "16px" }}>
              <Textarea
                label="Paste cURL Command"
                value={curlString}
                onChange={(e) => setCurlString(e.target.value)}
                placeholder="curl -X POST http://localhost:8070/api -H 'Content-Type: application/json' -d '...'"
                rows={6}
                mono
              />
              <div style={{ display: "flex", gap: "8px" }}>
                <Button variant="secondary" onClick={() => { setShowCurlInput(false); setCurlString(""); }} style={{ flex: 1 }}>
                  Cancel
                </Button>
                <Button onClick={handleImportCurl} style={{ flex: 1 }}>
                  Parse & Load
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className={styles.form}>
              {selectedApi && (
                <div style={{ background: "var(--accent-glow, rgba(16, 185, 129, 0.05))", border: "1px solid var(--accent)", borderRadius: "var(--radius-sm)", padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem" }}>
                  <span>Editing saved config: <strong>{selectedApi.name}</strong></span>
                  <button type="button" onClick={handleClearForm} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", textDecoration: "underline" }}>Deselect</button>
                </div>
              )}
              <Input
                label="Test Name"
                value={form.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="e.g. Load Test Customer Endpoint"
                required
              />

              <Input
                label="Description"
                value={form.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                placeholder="Description of the API configuration"
              />

              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>HTTP Method</label>
                  <select
                    className={styles.select}
                    value={form.method}
                    onChange={(e) => handleInputChange("method", e.target.value)}
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                    <option value="PATCH">PATCH</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Test Strategy</label>
                  <select
                    className={styles.select}
                    value={form.testType}
                    onChange={(e) => handleInputChange("testType", e.target.value)}
                  >
                    <option value="LOAD">LOAD</option>
                    <option value="STRESS">STRESS</option>
                    <option value="SPIKE">SPIKE</option>
                    <option value="SOAK">SOAK</option>
                  </select>
                </div>
              </div>

              <Input
                label="Target URL"
                value={form.url}
                onChange={(e) => handleInputChange("url", e.target.value)}
                placeholder="http://localhost:8070/api"
                required
              />

              <Textarea
                label="Headers (JSON format)"
                value={form.headers}
                onChange={(e) => handleInputChange("headers", e.target.value)}
                placeholder="{}"
                rows={3}
                mono
              />

              {form.method !== "GET" && (
                <Textarea
                  label="Request Body"
                  value={form.body}
                  onChange={(e) => handleInputChange("body", e.target.value)}
                  placeholder="Request Payload"
                  rows={3}
                  mono
                />
              )}

              <Textarea
                label="Payload List (One entry per line for virtual users)"
                value={form.payloadListStr}
                onChange={(e) => handleInputChange("payloadListStr", e.target.value)}
                placeholder="Payload 1&#10;Payload 2&#10;Payload 3"
                rows={3}
                mono
              />

              <div className={styles.formGrid}>
                <Input
                  label="Virtual Users"
                  type="number"
                  min="1"
                  value={form.virtualUsers}
                  onChange={(e) => handleInputChange("virtualUsers", e.target.value)}
                />
                <Input
                  label="Duration (sec)"
                  type="number"
                  min="1"
                  value={form.durationSeconds}
                  onChange={(e) => handleInputChange("durationSeconds", e.target.value)}
                />
              </div>

              {/* Strategy specific parameters */}
              {form.testType === "STRESS" && (
                <div className={styles.formGrid}>
                  <Input
                    label="Ramp Step (Users)"
                    type="number"
                    value={form.stressRampStep}
                    onChange={(e) => handleInputChange("stressRampStep", e.target.value)}
                  />
                  <Input
                    label="Ramp Interval (sec)"
                    type="number"
                    value={form.stressRampIntervalSeconds}
                    onChange={(e) => handleInputChange("stressRampIntervalSeconds", e.target.value)}
                  />
                </div>
              )}

              {form.testType === "SPIKE" && (
                <div className={styles.formGrid}>
                  <Input
                    label="Spike Users"
                    type="number"
                    value={form.spikeUsers}
                    onChange={(e) => handleInputChange("spikeUsers", e.target.value)}
                  />
                  <Input
                    label="Spike Duration (sec)"
                    type="number"
                    value={form.spikeDurationSeconds}
                    onChange={(e) => handleInputChange("spikeDurationSeconds", e.target.value)}
                  />
                </div>
              )}

              {form.testType === "SOAK" && (
                <Input
                  label="Soak Duration (sec)"
                  type="number"
                  value={form.soakDurationSeconds}
                  onChange={(e) => handleInputChange("soakDurationSeconds", e.target.value)}
                />
              )}

              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleSaveApi}
                  style={{ flex: 1 }}
                >
                  {selectedApi ? "Update Saved API" : "Save API Config"}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSubmitting || !!activeRunId}
                  style={{ flex: 1.5 }}
                >
                  {isSubmitting ? "Starting..." : activeRunId ? "Test In Progress" : "Run Performance Test"}
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* Right Side: Active Output & Metrics */}
        <div className={styles.card}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: "16px" }}>
            <h2 className={styles.cardTitle} style={{ marginBottom: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 6 }}>
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              Execution details
            </h2>
            {activeRunId && (
              <div className={styles.headerActions}>
                <Button variant="danger" size="small" onClick={handleCancel}>
                  Cancel Run
                </Button>
              </div>
            )}
          </div>

          {/* If there's an active run or loaded run */}
          {liveStats ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div>
                  <h3 style={{ margin: 0 }}>{liveStats.name}</h3>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 4 }}>
                    {liveStats.resolvedMethod || liveStats.method} {liveStats.resolvedUrl || liveStats.url}
                  </div>
                </div>
                <span className={`${styles.badge} ${getBadgeClass(liveStats.status)}`}>
                  {liveStats.status}
                </span>
              </div>

              {/* Progress bar */}
              {activeRunId && (
                <div className={styles.progressContainer}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: 4 }}>
                    <span>Running Test Strategy: {liveStats.testType}</span>
                  </div>
                  <div className={styles.progressBarBg}>
                    <div className={styles.progressBarFill} style={{ width: "100%" }} />
                  </div>
                </div>
              )}

              {/* Display Error Summary if present */}
              {liveStats.errorSummary && (
                <div style={{ background: "#fef2f2", color: "#991b1b", padding: "12px", borderRadius: "var(--radius-sm)", marginBottom: "16px", fontSize: "0.9rem", border: "1px solid #fee2e2" }}>
                  <strong>Error Summary:</strong>
                  <div style={{ marginTop: 4, whiteSpace: "pre-wrap", fontFamily: "var(--font-mono)", fontSize: "0.82rem", background: "rgba(255,255,255,0.5)", padding: "8px", borderRadius: "4px" }}>
                    {liveStats.errorSummary}
                  </div>
                </div>
              )}

              {/* Metric boxes */}
              <div className={styles.metricsGrid}>
                <div className={styles.metricCard}>
                  <span className={styles.metricValue}>
                    {liveStats.throughputRps != null ? liveStats.throughputRps.toFixed(1) : "—"}
                  </span>
                  <span className={styles.metricLabel}>Throughput (RPS)</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricValue}>
                    {liveStats.avgLatencyMs != null ? `${liveStats.avgLatencyMs.toFixed(1)}ms` : "—"}
                  </span>
                  <span className={styles.metricLabel}>Avg Latency</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricValue}>
                    {liveStats.totalRequests || 0}
                  </span>
                  <span className={styles.metricLabel}>Total Requests</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricValue} style={{ color: (liveStats.errorRatePercent || 0) > 0 ? "var(--status-error)" : "inherit" }}>
                    {liveStats.errorRatePercent != null ? `${liveStats.errorRatePercent.toFixed(1)}%` : "0%"}
                  </span>
                  <span className={styles.metricLabel}>Error Rate</span>
                </div>
              </div>

              {/* Latency Percentiles */}
              {(liveStats.p50LatencyMs || liveStats.p95LatencyMs || liveStats.p99LatencyMs) && (
                <div className={styles.metricsGrid} style={{ marginTop: "-8px" }}>
                  <div className={styles.metricCard}>
                    <span className={styles.metricValue} style={{ fontSize: "1.2rem" }}>
                      {liveStats.p50LatencyMs ? `${liveStats.p50LatencyMs.toFixed(1)}ms` : "—"}
                    </span>
                    <span className={styles.metricLabel}>p50 Latency</span>
                  </div>
                  <div className={styles.metricCard}>
                    <span className={styles.metricValue} style={{ fontSize: "1.2rem" }}>
                      {liveStats.p95LatencyMs ? `${liveStats.p95LatencyMs.toFixed(1)}ms` : "—"}
                    </span>
                    <span className={styles.metricLabel}>p95 Latency</span>
                  </div>
                  <div className={styles.metricCard}>
                    <span className={styles.metricValue} style={{ fontSize: "1.2rem" }}>
                      {liveStats.p99LatencyMs ? `${liveStats.p99LatencyMs.toFixed(1)}ms` : "—"}
                    </span>
                    <span className={styles.metricLabel}>p99 Latency</span>
                  </div>
                </div>
              )}

              {/* SVG Timeline Chart */}
              <div className={styles.chartContainer}>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "0.85rem", textTransform: "uppercase", color: "var(--text-muted)" }}>Latency Timeline</h4>
                {renderChart()}
              </div>

              {/* Ratings and Recommendations */}
              {rating && (
                <div className={`${styles.ratingContainer} ${styles["rating" + rating.rating]}`}>
                  <div className={styles.ratingHeader}>
                    <span className={styles.ratingTitle}>Performance Rating: {rating.rating}</span>
                    <span style={{ fontSize: "0.85rem", fontWeight: "500" }}>RPS: {rating.throughputRps?.toFixed(1) || 0}</span>
                  </div>
                  <p style={{ margin: "4px 0 12px 0", fontSize: "0.9rem" }}>{rating.summary}</p>

                  {rating.errorSummary && (
                    <div style={{ background: "rgba(255,255,255,0.6)", padding: "10px", borderRadius: "4px", marginBottom: "12px", borderLeft: "4px solid var(--status-error, #ef4444)" }}>
                      <strong>Rating Error Summary:</strong>
                      <div style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: "0.8rem", whiteSpace: "pre-wrap" }}>
                        {rating.errorSummary}
                      </div>
                    </div>
                  )}

                  <div className={styles.ratingLists}>
                    <div className={styles.ratingList}>
                      <span className={styles.ratingListTitle}>👍 Strengths</span>
                      {rating.strengths?.length === 0 && <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>No notable strengths.</span>}
                      {rating.strengths?.map((str, idx) => (
                        <div key={idx} className={styles.strengthItem}>
                          <span>✓</span>
                          <span>{str}</span>
                        </div>
                      ))}
                    </div>

                    <div className={styles.ratingList}>
                      <span className={styles.ratingListTitle}>⚠️ Areas for Improvement</span>
                      {rating.issues?.length === 0 && <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>No issues detected.</span>}
                      {rating.issues?.map((iss, idx) => (
                        <div key={idx} className={styles.issueItem}>
                          <span>•</span>
                          <span>{iss}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Real-time Streaming Event Log Terminal */}
              {activeRunId && (
                <div style={{ marginTop: "16px" }}>
                  <h4 style={{ margin: "0 0 6px 0", fontSize: "0.85rem", color: "var(--text-muted)" }}>SSE Event Stream Logs</h4>
                  <div className={styles.logsTerminal} ref={logsTerminalRef}>
                    {logLines.map((line, idx) => (
                      <div key={idx} className={styles.logLine}>{line}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "350px", color: "var(--text-muted)" }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 12 }}>
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <h3>No Active Test Execution</h3>
              <p>Run a performance test or select an item from the history panel.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
