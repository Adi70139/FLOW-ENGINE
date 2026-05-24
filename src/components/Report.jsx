import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useModules } from "../context/CollectionContext";
import { api } from "../utils/api";
import Button from "./ui/button/Button";
import EmptyState from "./ui/empty-state/EmptyState";
import Badge from "./ui/badge/Badge";
import { IconBack, IconFlow, IconChevron } from "./ui/icons/Icons";
import styles from "./Report.module.css";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function openPdfInTab(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
    window.open(blobUrl, "_blank");
  } catch {
    window.open(url, "_blank");
  }
}

function statusVariant(status = "") {
  const s = String(status).toUpperCase();
  if (s === "PASSED" || s === "SUCCESS" || s === "COMPLETED") return "success";
  if (s === "FAILED" || s === "FAIL" || s === "ERROR" || s === "PARTIAL_FAIL") return "danger";
  if (s === "RUNNING" || s === "IN_PROGRESS") return "warning";
  return "default";
}

function fmtMs(ms) {
  if (!ms && ms !== 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch { return iso; }
}

function tryFormatJson(json) {
  if (!json) return "—";
  try {
    const obj = typeof json === "string" ? JSON.parse(json) : json;
    return JSON.stringify(obj, null, 2);
  } catch { return String(json); }
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ label, value, sub, variant }) {
  return (
    <div className={`${styles.card} ${variant ? styles[variant] : ""}`}>
      <div className={styles.cardLabel}>{label}</div>
      <div className={styles.cardValue}>{value}</div>
      {sub && <p className={styles.cardSub}>{sub}</p>}
    </div>
  );
}

/** 
 * Step Detail: Shows the deep-dive of a single step execution 
 */
function StepDetail({ step }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`${styles.stepWrapper} ${isOpen ? styles.stepOpen : ""}`}>
      <div className={styles.stepHeader} onClick={() => setIsOpen(!isOpen)}>
        <div className={styles.stepTitleSide}>
          <div className={styles.stepNumber}>{step.stepOrder || "—"}</div>
          <Badge variant={step.method?.toLowerCase() || "get"}>{step.method || "GET"}</Badge>
          <span className={styles.stepName}>{step.stepName || "Untitled Step"}</span>
        </div>
        <div className={styles.stepMetaSide}>
          <span className={styles.stepDuration}>{fmtMs(step.durationMs)}</span>
          <Badge variant={statusVariant(step.status)}>{step.statusCode || step.status || "???"}</Badge>
          <IconChevron size={16} className={styles.stepChevron} />
        </div>
      </div>
      
      {isOpen && (
        <div className={styles.stepContent}>
          <div className={styles.stepGrid}>
            <div className={styles.stepColumn}>
              <h4>Request Info</h4>
              <div className={styles.codeBlock}>
                <label>Resolved URL</label>
                <pre>{step.resolvedUrl || step.url || "—"}</pre>
              </div>
              <div className={styles.codeBlock}>
                <label>Headers</label>
                <pre>{tryFormatJson(step.resolvedHeadersJson)}</pre>
              </div>
              <div className={styles.codeBlock}>
                <label>Body</label>
                <pre>{tryFormatJson(step.resolvedBodyJson)}</pre>
              </div>
            </div>
            <div className={styles.stepColumn}>
              <h4>Response</h4>
              {step.errorMessage && (
                <div className={styles.errorText}>
                  <strong>Error:</strong> {step.errorMessage}
                </div>
              )}
              <div className={styles.codeBlock}>
                <label>Body</label>
                <pre>{tryFormatJson(step.responseBody)}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Bulk Report View */
function BulkView({ data }) {
  if (!data) return <EmptyState icon="📦" title="Job not found" subtitle="The requested bulk job data could not be retrieved." />;

  return (
    <div className={styles.reportArea}>
      <div className={styles.summaryGrid}>
        <StatCard label="Job Status" value={<Badge variant={statusVariant(data.status)}>{data.status}</Badge>} />
        <StatCard label="Total Items" value={data.totalItems || 0} />
        <StatCard label="Passed" value={data.passedItems || 0} variant="success" />
        <StatCard label="Failed" value={data.failedItems || 0} variant="danger" />
        <StatCard label="Duration" value={fmtMs(data.durationMs)} />
        <StatCard label="Finished At" value={fmtDate(data.finishedAt)} />
      </div>

      <div className={styles.sectionTitle}>Execution Items</div>
      <div className={styles.list}>
        {(data.items || []).map((item, i) => (
          <div key={i} className={styles.listItem}>
            <div className={styles.itemInfo}>
              <IconFlow size={20} className={styles.itemIcon} />
              <div>
                <h3>{item.targetName || `Item ${item.targetId}`}</h3>
                <p>Type: {data.type} • ID: {item.executionId || item.targetId}</p>
              </div>
            </div>
            <div className={styles.itemActions}>
              <span className={styles.durationLabel}>{fmtMs(item.durationMs)}</span>
              <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Module Report View */
function ModuleView({ data }) {
  if (!data) return <EmptyState icon="📦" title="Execution not found" subtitle="Could not load module execution details." />;

  return (
    <div className={styles.reportArea}>
      <div className={styles.summaryGrid}>
        <StatCard label="Module" value={data.moduleName || "—"} />
        <StatCard label="Final Status" value={<Badge variant={statusVariant(data.status)}>{data.status}</Badge>} />
        <StatCard label="Flows" value={`${data.passedFlows || 0} / ${data.totalFlows || 0} Passed`} />
        <StatCard label="Duration" value={fmtMs(data.durationMs)} />
        <StatCard label="Started At" value={fmtDate(data.startedAt)} />
        <StatCard label="Finished At" value={fmtDate(data.finishedAt)} />
      </div>

      <div className={styles.sectionTitle}>Flow Executions</div>
      <div className={styles.list}>
        {(data.flows || []).map((flow, i) => (
          <div key={i} style={{ marginBottom: "32px" }}>
            <div className={styles.listItem} style={{ marginBottom: "16px" }}>
              <div className={styles.itemInfo}>
                <IconFlow size={20} className={styles.itemIcon} />
                <div>
                  <h3>{flow.flowName}</h3>
                  <p>{flow.steps?.length || 0} Steps • {fmtMs(flow.durationMs)}</p>
                </div>
              </div>
              <div className={styles.itemActions}>
                <Badge variant={statusVariant(flow.status)}>{flow.status}</Badge>
              </div>
            </div>

            <div className={styles.stepsList} style={{ marginLeft: "24px", paddingLeft: "16px", borderLeft: "2px solid var(--border)" }}>
              {(flow.steps || []).map((step, idx) => (
                <StepDetail key={step.stepId || idx} step={step} />
              ))}
              {(flow.steps || []).length === 0 && (
                <div className={styles.emptySteps} style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                  No steps were executed in this flow.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Flow Report View */
function FlowView({ data }) {
  if (!data) return <EmptyState icon="🌊" title="Report unavailable" subtitle="No execution data found for this flow." />;

  return (
    <div className={styles.reportArea}>
      <div className={styles.summaryGrid}>
        <StatCard label="Flow Name" value={data.flowName || "—"} />
        <StatCard label="Status" value={<Badge variant={statusVariant(data.status)}>{data.status}</Badge>} />
        <StatCard label="Total Steps" value={data.steps?.length || 0} />
        <StatCard label="Duration" value={fmtMs(data.durationMs)} />
        <StatCard label="Module" value={data.moduleName || "—"} />
        <StatCard label="Executed At" value={fmtDate(data.finishedAt)} />
      </div>

      <div className={styles.sectionTitle}>Execution Steps</div>
      <div className={styles.stepsList}>
        {(data.steps || []).map((step, i) => (
          <StepDetail key={step.stepId || i} step={step} />
        ))}
        {(data.steps || []).length === 0 && (
          <div className={styles.emptySteps}>No steps were executed in this run.</div>
        )}
      </div>
    </div>
  );
}

/** History Sidebar Item */
function HistoryItem({ item, active, onClick }) {
  const passed = ["PASSED", "SUCCESS", "COMPLETED"].includes(String(item.results?.status || item.results?.allFlowsPassed ? "PASSED" : "").toUpperCase());
  const label = item.type === "bulk" ? "Bulk Job" : item.type === "module" ? `Module: ${item.results?.moduleName || item.id}` : `Flow: ${item.results?.flowName || item.id}`;

  return (
    <div className={`${styles.historyItem} ${active ? styles.activeItem : ""}`} onClick={onClick}>
      <div className={styles.historyDot} style={{ background: passed ? "#10b981" : "#ef4444" }} />
      <div className={styles.historyInfo}>
        <span className={styles.historyType}>{item.type.toUpperCase()}</span>
        <span className={styles.historyLabel}>{label}</span>
        <span className={styles.historyDate}>{fmtDate(item.finishedAt)}</span>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

const TABS = [
  { key: "summary", label: "Dashboard" },
  { key: "module", label: "Modules" },
  { key: "flow", label: "Flows" },
  { key: "bulk", label: "Bulk Jobs" },
  { key: "schedule", label: "Scheduled Runs" },
];

function ScheduleAnalyticsView({ modules }) {
  const [availableModules, setAvailableModules] = useState(modules);
  const scheduledModules = availableModules.filter((module) => module.schedule?.active);
  const fallbackModuleId = scheduledModules[0]?.id || availableModules[0]?.id || "";
  const [moduleId, setModuleId] = useState(fallbackModuleId ? String(fallbackModuleId) : "");
  const [runs, setRuns] = useState([]);
  const [pageInfo, setPageInfo] = useState(null);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");

  const selectedModule = availableModules.find((module) => String(module.id) === String(moduleId));
  const totalRuns = pageInfo?.totalElements || runs.length;
  const passedRuns = runs.filter((run) => ["PASS", "PASSED", "SUCCESS", "COMPLETED"].includes(String(run.status).toUpperCase())).length;
  const failedRuns = runs.filter((run) => ["FAIL", "FAILED", "ERROR"].includes(String(run.status).toUpperCase())).length;
  const skippedSteps = runs.reduce((sum, run) => sum + (run.skippedSteps || 0), 0);

  useEffect(() => {
    if (modules.length > 0) {
      setAvailableModules(modules);
      return;
    }

    api
      .getModules()
      .then((data) => setAvailableModules(data || []))
      .catch(() => setAvailableModules([]));
  }, [modules]);

  const loadRuns = useCallback(async () => {
    if (!moduleId) return;
    setLoadingRuns(true);
    setError("");
    try {
      const page = await api.getModuleScheduleRuns(moduleId, 0, 20);
      const content = page?.content || [];
      setRuns(content);
      setPageInfo(page);
      const nextRunId = content[0]?.executionId || null;
      setSelectedRunId(nextRunId);
    } catch (err) {
      setRuns([]);
      setPageInfo(null);
      setSelectedRunId(null);
      setDetail(null);
      setError(err.message || "Failed to load scheduled runs.");
    } finally {
      setLoadingRuns(false);
    }
  }, [moduleId]);

  useEffect(() => {
    if (!moduleId && fallbackModuleId) setModuleId(String(fallbackModuleId));
  }, [moduleId, fallbackModuleId]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    async function loadDetail() {
      if (!selectedRunId) {
        setDetail(null);
        return;
      }
      setLoadingDetail(true);
      setError("");
      try {
        const data = await api.getModuleScheduleRunDetail(selectedRunId);
        setDetail(data);
      } catch (err) {
        setDetail(null);
        setError(err.message || "Failed to load scheduled run detail.");
      } finally {
        setLoadingDetail(false);
      }
    }
    loadDetail();
  }, [selectedRunId]);

  if (availableModules.length === 0) {
    return <EmptyState icon="⏱" title="No modules available" subtitle="Create a module and schedule it to start collecting scheduled run analytics." />;
  }

  return (
    <div className={styles.reportArea}>
      <div className={styles.filterBar}>
        <div>
          <label>Module</label>
          <select value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
            {availableModules.map((module) => (
              <option key={module.id} value={module.id}>
                {module.name}{module.schedule?.active ? " • scheduled" : ""}
              </option>
            ))}
          </select>
        </div>
        <Button variant="secondary" size="small" onClick={loadRuns} disabled={loadingRuns} icon={loadingRuns ? <span className={styles.spinner} /> : "↻"}>
          Refresh Runs
        </Button>
      </div>

      {error && <div className={styles.errorBanner}>⚠️ {error}</div>}

      <div className={styles.summaryGrid}>
        <StatCard label="Module" value={selectedModule?.name || "—"} sub={selectedModule?.schedule?.active ? `${selectedModule.schedule.time} • ${selectedModule.schedule.timezone}` : "No active schedule"} />
        <StatCard label="Scheduled Runs" value={totalRuns} />
        <StatCard label="Passed" value={passedRuns} variant="success" />
        <StatCard label="Failed" value={failedRuns} variant={failedRuns > 0 ? "danger" : ""} />
        <StatCard label="Skipped Steps" value={skippedSteps} variant={skippedSteps > 0 ? "warning" : ""} />
        <StatCard label="Latest Status" value={runs[0] ? <Badge variant={statusVariant(runs[0].status)}>{runs[0].status}</Badge> : "—"} sub={fmtDate(runs[0]?.finishedAt || runs[0]?.startedAt)} />
      </div>

      <div className={styles.analyticsGrid}>
        <section>
          <div className={styles.sectionTitle}>Scheduled Job Results</div>
          <div className={styles.list}>
            {runs.map((run) => (
              <button
                key={run.executionId}
                className={`${styles.runRow} ${String(selectedRunId) === String(run.executionId) ? styles.runRowActive : ""}`}
                onClick={() => setSelectedRunId(run.executionId)}
              >
                <div>
                  <h3>Run #{run.executionId}</h3>
                  <p>{fmtDate(run.startedAt)} • {run.passedFlows || 0}/{run.totalFlows || 0} flows passed</p>
                </div>
                <div className={styles.itemActions}>
                  <span className={styles.durationLabel}>{fmtMs(run.durationMs)}</span>
                  <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
                </div>
              </button>
            ))}
            {!loadingRuns && runs.length === 0 && (
              <div className={styles.emptySteps}>No scheduled executions found for this module.</div>
            )}
          </div>
        </section>

        <section>
          <div className={styles.sectionTitle}>Run Detail</div>
          {loadingDetail ? (
            <div className={styles.loadingPanel}><span className={styles.spinner} /> Loading run detail...</div>
          ) : detail ? (
            <div className={styles.detailPanel}>
              <div className={styles.detailHeader}>
                <div>
                  <h3>{detail.moduleName}</h3>
                  <p>Execution #{detail.executionId} • {fmtMs(detail.durationMs)}</p>
                </div>
                <Badge variant={statusVariant(detail.status)}>{detail.status}</Badge>
              </div>
              {(detail.flows || []).map((flow) => (
                <div key={flow.flowExecutionId || flow.flowId} className={styles.scheduleFlowBlock}>
                  <div className={styles.scheduleFlowHeader}>
                    <div>
                      <h4>{flow.flowName}</h4>
                      <p>{(flow.steps || []).length} steps • {fmtMs(flow.durationMs)}</p>
                    </div>
                    <Badge variant={statusVariant(flow.status)}>{flow.status}</Badge>
                  </div>
                  <div className={styles.stepsList}>
                    {(flow.steps || []).map((step, index) => (
                      <StepDetail key={step.stepExecutionId || step.stepId || index} step={step} />
                    ))}
                  </div>
                </div>
              ))}
              {(detail.flows || []).length === 0 && <div className={styles.emptySteps}>No flow details returned for this run.</div>}
            </div>
          ) : (
            <div className={styles.emptySteps}>Select a scheduled run to inspect its flow and step results.</div>
          )}
        </section>
      </div>
    </div>
  );
}

function Report() {
  const navigate = useNavigate();
  const location = useLocation();
  const { modules, executions } = useModules();

  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const activeTab = query.get("type") || "summary";
  const idParam = query.get("id");
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);

  const history = useMemo(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("mr_auto_history") || "[]");
      // Unique-ify by execution ID
      const seen = new Set();
      return raw.filter(item => {
        const uid = item.results?.bulkJobId || item.results?.moduleExecutionId || item.results?.flowId || `${item.type}-${item.id}-${item.finishedAt}`;
        if (seen.has(uid)) return false;
        seen.add(uid);
        return true;
      });
    } catch { return []; }
  }, [executions]); // Re-compute when context executions change

  const fetchData = useCallback(async () => {
    if (activeTab === "schedule") {
      setReportData(null);
      return;
    }
    if (!idParam && activeTab !== "summary") {
      setReportData(null);
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      let data = null;
      if (activeTab === "bulk" && idParam) {
        data = await api.getBulkReportData(idParam);
      } else if (activeTab === "module" && idParam) {
        // idParam might be moduleId (legacy) or moduleExecutionId
        // Try as execution ID first, then fallback to looking up latest for module
        try {
          data = await api.getModuleReportData(idParam);
        } catch {
          const modExec = Object.values(executions).find(ex => ex.id == idParam && ex.type === 'module')?.results?.moduleExecutionId;
          if (modExec) data = await api.getModuleReportData(modExec);
        }
      } else if (activeTab === "flow" && idParam) {
        data = await api.getFlowReportData(idParam);
      } else if (activeTab === "summary") {
        // For dashboard, show latest bulk or module run
        const latest = history[0];
        if (latest) {
          const id = latest.results?.bulkJobId || latest.results?.moduleExecutionId || latest.results?.flowId;
          if (latest.type === "bulk") data = await api.getBulkReportData(id);
          else if (latest.type === "module") data = await api.getModuleReportData(id);
          else if (latest.type === "flow") data = await api.getFlowReportData(id);
        }
      }
      setReportData(data);
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Failed to load execution data. The record may have expired or is still processing.");
    } finally {
      setLoading(false);
    }
  }, [activeTab, idParam, history, executions]);

  useEffect(() => {
    fetchData();
  }, [activeTab, idParam]); // intentionally omit fetchData to avoid loops if not stable

  // Handle sidebar navigation
  const handleHistoryClick = (item) => {
    const id = item.results?.bulkJobId || item.results?.moduleExecutionId || item.results?.flowId;
    navigate(`/report?type=${item.type}&id=${id}`, { replace: true });
  };

  const getDownloadUrl = () => {
    if (activeTab === "schedule" && idParam) return api.getModuleReport(idParam);
    if (!reportData) return null;
    if (activeTab === "summary") {
      const latest = history[0];
      if (!latest) return null;
      const id = latest.results?.bulkJobId || latest.results?.moduleExecutionId || latest.results?.flowId;
      if (!id) return null;
      if (latest.type === "bulk") return api.getBulkReport(id);
      if (latest.type === "module") return api.getModuleReport(id);
      if (latest.type === "flow") return api.getFlowReport(id);
    } else if (idParam) {
      if (activeTab === "bulk") return api.getBulkReport(idParam);
      if (activeTab === "module") return api.getModuleReport(idParam);
      if (activeTab === "flow") return api.getFlowReport(idParam);
    }
    return null;
  };

  const downloadUrl = getDownloadUrl();

  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h3>Execution History</h3>
          <span className={styles.historyCount}>{history.length} runs</span>
        </div>
        <div className={styles.historyList}>
          {history.map((item, i) => (
            <HistoryItem
              key={i}
              item={item}
              active={idParam === String(item.results?.bulkJobId || item.results?.moduleExecutionId || item.results?.flowId)}
              onClick={() => handleHistoryClick(item)}
            />
          ))}
          {history.length === 0 && <div className={styles.emptyHistory}>No recent activity</div>}
        </div>
      </aside>

      <div className={styles.content}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <button className={styles.backBtn} onClick={() => navigate(-1)}>
              <IconBack size={20} />
            </button>
            <div>
              <h1>Automation Analytics</h1>
              <p>Detailed performance metrics and execution logs.</p>
            </div>
          </div>
          <div className={styles.headerRight}>
            {downloadUrl && (
              <Button
                variant="primary"
                size="small"
                onClick={() => openPdfInTab(downloadUrl)}
                icon="📥"
              >
                Export PDF
              </Button>
            )}
            <Button variant="secondary" size="small" onClick={fetchData} disabled={loading} icon={loading ? <span className={styles.spinner} /> : "↻"}>
              Refresh
            </Button>
          </div>
        </header>

        <div className={styles.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`${styles.tab} ${activeTab === tab.key ? styles.active : ""}`}
              onClick={() => {
                if (tab.key === 'summary') navigate('/report?type=summary', { replace: true });
                else navigate(`/report?type=${tab.key}`, { replace: true });
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && <div className={styles.errorBanner}>⚠️ {error}</div>}

        <main className={styles.main}>
          {loading ? (
            <div className={styles.loadingContainer}>
              <span className={styles.mainSpinner} />
              <p>Fetching execution data...</p>
            </div>
          ) : (
            <>
              {activeTab === "summary" && (reportData ? (
                reportData.bulkJobId ? <BulkView data={reportData} /> : 
                reportData.moduleExecutionId ? <ModuleView data={reportData} /> : 
                <FlowView data={reportData} />
              ) : <EmptyState icon="📊" title="Dashboard Empty" subtitle="Select a historical run from the sidebar to begin." />)}

              {activeTab === "bulk" && <BulkView data={reportData} />}
              {activeTab === "module" && <ModuleView data={reportData} />}
              {activeTab === "flow" && <FlowView data={reportData} />}
              {activeTab === "schedule" && <ScheduleAnalyticsView modules={modules} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default Report;
