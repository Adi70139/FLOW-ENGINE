import { useState, useEffect } from "react";
import { useModules } from "../context/CollectionContext";
import Badge from "./ui/badge/Badge";
import IconButton from "./ui/icon-button/IconButton";
import Button from "./ui/button/Button";
import { IconStep, IconDelete, IconPlus, IconFlow } from "./ui/icons/Icons";
import styles from "./TestList.module.css";

function TestList({ onAddTest }) {
  const { selectedFlow, selectedFlowId, selectedStepId, dispatch, deleteStep, fetchSteps } =
    useModules();

  useEffect(() => {
    if (selectedFlowId) {
      fetchSteps(selectedFlowId);
    }
  }, [selectedFlowId]);

  const tests = selectedFlow?.tests || [];

  const [dragIndex, setDragIndex] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);

  function handleDragStart(e, idx) {
    // Reordering not fully supported by backend yet
    // setDragIndex(idx);
    // e.dataTransfer.effectAllowed = "move";
    // e.dataTransfer.setData("text/plain", idx.toString());
  }

  function handleDragOver(e, idx) {
    e.preventDefault();
    // e.dataTransfer.dropEffect = "move";
    // setDropIndex(idx);
  }

  function handleDragLeave() {
    setDropIndex(null);
  }

  function handleDrop(e, idx) {
    e.preventDefault();
    /*
    if (dragIndex == null || dragIndex === idx) {
      setDragIndex(null);
      setDropIndex(null);
      return;
    }
    const next = [...tests];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(idx, 0, moved);
    dispatch({
      type: "REORDER_TESTS",
      flowId: selectedFlowId,
      tests: next,
    });
    setDragIndex(null);
    setDropIndex(null);
    */
  }

  function handleDragEnd() {
    setDragIndex(null);
    setDropIndex(null);
  }

  function handleDelete(e, stepId) {
    e.stopPropagation();
    if (confirm("Delete this step?")) {
      deleteStep(selectedFlowId, stepId);
    }
  }

  function handleSelect(stepId) {
    dispatch({ type: "SELECT_STEP", id: stepId });
  }

  if (!selectedFlow) {
    return (
      <div className={styles.empty}>
        <IconFlow size={48} style={{ opacity: 0.1, marginBottom: 12 }} />
        Select a flow to view tests
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {tests.length === 0 && (
        <div className={styles.empty}>
          <IconStep size={40} style={{ opacity: 0.1, marginBottom: 12 }} />
          No steps yet. Create one to start automating.
        </div>
      )}

      {tests.map((t, i) => (
        <div key={t.id}>
          {dropIndex === i && dragIndex !== i && dragIndex !== i - 1 && (
            <div className={styles.dropIndicator} />
          )}

          <div
            className={`${styles.item} ${t.id === selectedStepId ? styles.active : ""} ${dragIndex === i ? styles.dragging : ""}`}
            draggable={false} // Disable drag for now
            onDragStart={(e) => handleDragStart(e, i)}
            onDragOver={(e) => handleDragOver(e, i)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, i)}
            onDragEnd={handleDragEnd}
            onClick={() => handleSelect(t.id)}
          >
            <span className={styles.dragHandle} title="Reordering coming soon">
              ⋮⋮
            </span>
            <Badge variant={t.method?.toLowerCase() || "get"}>
              {t.method || "GET"}
            </Badge>
            <div className={styles.info}>
              <div className={styles.name}>{t.name}</div>
              {t.endpoint && (
                <div className={styles.meta}>
                  {t.endpoint.length > 40
                    ? t.endpoint.slice(0, 40) + "…"
                    : t.endpoint}
                </div>
              )}
            </div>
            <div className={styles.actions}>
              <IconButton
                size="small"
                variant="danger"
                title="Delete test"
                onClick={(e) => handleDelete(e, t.id)}
              >
                <IconDelete size={14} />
              </IconButton>
            </div>
          </div>
        </div>
      ))}

      {dropIndex === tests.length && dragIndex !== tests.length - 1 && (
        <div className={styles.dropIndicator} />
      )}

      <div className={styles.addRow}>
        <Button variant="ghost" size="small" onClick={onAddTest} icon={<IconPlus size={14} />}>
          Add Step
        </Button>
      </div>
    </div>
  );
}

export default TestList;
