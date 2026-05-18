import { useState, useEffect } from "react";
import { api } from "../utils/api";
import Badge from "./ui/badge/Badge";
import styles from "./FlowHistory.module.css";

function FlowHistory({ flowId }) {
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedRunId, setExpandedRunId] = useState(null);

  useEffect(() => {
    if (!flowId) return;
    setLoading(true);
    setError("");
    api.getFlowHistory(flowId)
      .then(data => {
        setHistoryData(data);
      })
      .catch(err => {
        console.error("Failed to fetch flow history:", err);
        setError("Failed to load flow history.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [flowId]);

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <span>Loading flow execution history...</span>
      </div>
    );
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  if (!historyData || !historyData.runs || historyData.runs.length === 0) {
    return <div className={styles.empty}>No past executions found. Run the flow to populate history!</div>;
  }

  const { trend = {}, runs = [] } = historyData;

  function toggleExpand(runId) {
    setExpandedRunId(expandedRunId === runId ? null : runId);
  }

  function formatDate(isoStr) {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function getTrendIcon(status) {
    switch (status?.toUpperCase()) {
      case "STABLE": return "➡️";
      case "IMPROVING": return "📈";
      case "DETERIORATING": return "📉";
      default: return "📊";
    }
  }

  return (
    <div className={styles.container}>
      {/* ── Trend Summary Banner ── */}
      <div className={styles.summaryBanner}>
        <div className={styles.summaryTop}>
          <div className={styles.summaryTitleBlock}>
            <span className={styles.summaryLabel}>Pass Rate</span>
            <span className={styles.summaryValue}>{trend.passRatePercent?.toFixed(0)}%</span>
          </div>
          <div className={styles.summaryTitleBlock}>
            <span className={styles.summaryLabel}>Avg Duration</span>
            <span className={styles.summaryValue}>{trend.avgDurationMs}ms</span>
          </div>
          <div className={styles.summaryTitleBlock}>
            <span className={styles.summaryLabel}>Trend</span>
            <span className={styles.summaryValue} style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}>
              {getTrendIcon(trend.trend)} {trend.trend}
            </span>
          </div>
        </div>
        <div className={styles.streakGrid}>
          <span>Fail Streaks (Current / Longest):</span>
          <strong>{trend.currentFailStreak || 0} / {trend.longestFailStreak || 0} runs</strong>
        </div>
      </div>

      {/* ── Executions List ── */}
      <div className={styles.list}>
        <h4 className={styles.sectionTitle}>Past Executions ({runs.length})</h4>
        
        {runs.map((run) => {
          const isExpanded = expandedRunId === run.executionId;
          const passed = run.status?.toUpperCase() === "PASS";
          
          return (
            <div key={run.executionId} className={styles.runItem}>
              <div 
                className={`${styles.runHeader} ${isExpanded ? styles.runHeaderActive : ""}`}
                onClick={() => toggleExpand(run.executionId)}
              >
                <div className={styles.runHeaderLeft}>
                  <span className={`${styles.statusDot} ${passed ? styles.dotPass : styles.dotFail}`} />
                  <span className={styles.runId}>Run #{run.executionId}</span>
                  <span className={styles.runDate}>{formatDate(run.startedAt)}</span>
                </div>
                <div className={styles.runHeaderRight}>
                  <span className={styles.runDuration}>{run.durationMs}ms</span>
                  <span className={styles.arrow}>{isExpanded ? "▲" : "▼"}</span>
                </div>
              </div>

              {isExpanded && (
                <div className={styles.runDetails}>
                  <div className={styles.stepsTimeline}>
                    {run.steps && run.steps.map((step, idx) => (
                      <div key={step.stepId} className={styles.stepRow}>
                        <div className={styles.stepRowLeft}>
                          <span className={styles.stepNum}>{idx + 1}</span>
                          <span className={styles.stepName}>{step.stepName}</span>
                          <Badge variant={step.success ? "success" : "danger"}>
                            {step.statusCode || "ERR"}
                          </Badge>
                        </div>
                        <div className={styles.stepRowRight}>
                          <span className={styles.stepDuration}>{step.durationMs}ms</span>
                          {step.totalAttempts > 1 && (
                            <span className={styles.attemptsBadge}>{step.totalAttempts} attempts</span>
                          )}
                        </div>
                        {!step.success && step.errorMessage && (
                          <div className={styles.stepError}>
                            Error: {step.errorMessage}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default FlowHistory;
