import { useState, useEffect } from "react";
import { api } from "../utils/api";
import styles from "./FlowTrends.module.css";

function FlowTrends({ flowId }) {
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!flowId) return;
    setLoading(true);
    setError("");
    api.getStepTrends(flowId)
      .then(data => {
        setTrends(data || []);
      })
      .catch(err => {
        console.error("Failed to fetch step trends:", err);
        setError("Failed to load step trends.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [flowId]);

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <span>Loading step trends...</span>
      </div>
    );
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  if (trends.length === 0) {
    return <div className={styles.empty}>No trend data available. Run the flow to generate trends!</div>;
  }

  function getPassRateColor(percent) {
    if (percent === 100) return "var(--status-success)";
    if (percent >= 80) return "#eab308"; // warning yellow
    return "var(--status-error)";
  }

  return (
    <div className={styles.container}>
      {trends.map((t) => {
        const passRateColor = getPassRateColor(t.passRatePercent);
        
        return (
          <div key={t.stepId} className={`${styles.card} ${t.flaky ? styles.flakyCard : ""}`}>
            <div className={styles.cardHeader}>
              <div className={styles.stepInfo}>
                <span className={styles.stepOrder}>#{t.stepOrder}</span>
                <span className={styles.stepName}>{t.stepName}</span>
              </div>
              <div className={styles.badges}>
                {t.flaky && (
                  <span className={styles.flakyBadge}>
                    <span className={styles.pulseDot} />
                    ⚠️ FLAKY
                  </span>
                )}
                <span 
                  className={styles.passRateBadge} 
                  style={{ background: `${passRateColor}15`, color: passRateColor, border: `1px solid ${passRateColor}30` }}
                >
                  {t.passRatePercent.toFixed(0)}% Pass
                </span>
              </div>
            </div>

            <div className={styles.statsGrid}>
              <div className={styles.statBox}>
                <span className={styles.statLabel}>Total Runs</span>
                <span className={styles.statValue}>{t.totalRuns}</span>
              </div>
              <div className={styles.statBox}>
                <span className={styles.statLabel}>Avg Duration</span>
                <span className={styles.statValue}>{t.avgDurationMs}ms</span>
              </div>
              <div className={styles.statBox}>
                <span className={styles.statLabel}>Min/Max</span>
                <span className={styles.statValue} style={{ fontSize: "11px" }}>{t.minDurationMs}ms / {t.maxDurationMs}ms</span>
              </div>
            </div>

            {t.resultTimeline && t.resultTimeline.length > 0 && (
              <div className={styles.timelineSection}>
                <span className={styles.timelineLabel}>Last 20 Runs History</span>
                <div className={styles.timelineGrid}>
                  {t.resultTimeline.map((passed, idx) => (
                    <div 
                      key={idx} 
                      className={`${styles.timelineDot} ${passed ? styles.timelinePassed : styles.timelineFailed}`} 
                      title={passed ? "Passed" : "Failed"}
                    />
                  ))}
                </div>
              </div>
            )}

            {t.currentFailStreak > 0 && (
              <div className={styles.failureAlert}>
                <span className={styles.failIcon}>🚨</span>
                <div>
                  <strong>Failing Streak: {t.currentFailStreak} runs</strong>
                  {t.mostCommonError && (
                    <div className={styles.failError}>Common Error: {t.mostCommonError}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default FlowTrends;
