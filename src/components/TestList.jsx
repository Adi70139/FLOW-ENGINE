import { useState, useEffect } from "react";
import { useModules } from "../context/CollectionContext";
import Badge from "./ui/badge/Badge";
import IconButton from "./ui/icon-button/IconButton";
import Button from "./ui/button/Button";
import { IconStep, IconDelete, IconPlus, IconFlow } from "./ui/icons/Icons";
import styles from "./TestList.module.css";

function TestList({ onAddTest }) {
  const { 
    selectedFlow, 
    selectedFlowId, 
    selectedStepId, 
    dispatch, 
    deleteStep, 
    fetchSteps,
    updateStep 
  } = useModules();

  useEffect(() => {
    if (selectedFlowId) {
      fetchSteps(selectedFlowId);
    }
  }, [selectedFlowId]);

  const tests = selectedFlow?.tests || [];

  const [dragIndex, setDragIndex] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);

  function handleDragStart(e, idx) {
    setDragIndex(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", idx.toString());
  }

  function handleDragOver(e, idx) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropIndex(idx);
  }

  function handleDragLeave() {
    setDropIndex(null);
  }

  function handleDrop(e, idx) {
    e.preventDefault();
    if (dragIndex == null || dragIndex === idx) {
      setDragIndex(null);
      setDropIndex(null);
      return;
    }
    const next = [...tests];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(idx, 0, moved);
    
    // Update state immediately
    dispatch({
      type: "REORDER_TESTS",
      flowId: selectedFlowId,
      tests: next,
    });

    // Sync with backend (the backend will update all steps affected)
    updateStep(selectedFlowId, moved.id, moved, idx);

    setDragIndex(null);
    setDropIndex(null);
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
      <div className={styles.container}>
        <div className={styles.empty}>
          <IconFlow size={48} style={{ opacity: 0.1, marginBottom: 12 }} />
          <h3>No Flow Selected</h3>
          <p>Choose a flow from the sidebar to view its steps.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Steps ({tests.length})</h3>
      </div>

      <div className={styles.list}>
        {tests.length === 0 && (
          <div className={styles.empty}>
            <IconStep size={40} style={{ opacity: 0.1, marginBottom: 12 }} />
            <p>No steps yet. Create one to start automating.</p>
          </div>
        )}

        {tests.map((t, i) => (
          <div key={t.id}>
            {dropIndex === i && dragIndex !== i && dragIndex !== i - 1 && (
              <div className={styles.dropIndicator} />
            )}

            <div
              className={`${styles.item} ${t.id === selectedStepId ? styles.active : ""} ${dragIndex === i ? styles.dragging : ""}`}
              draggable
              onDragStart={(e) => handleDragStart(e, i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, i)}
              onDragEnd={handleDragEnd}
              onClick={() => handleSelect(t.id)}
            >
              <span className={styles.dragHandle} title="Drag to reorder">
                ⋮⋮
              </span>
              <Badge variant={t.method?.toLowerCase() || "get"}>
                {t.method || "GET"}
              </Badge>
              <div className={styles.info}>
                <div className={styles.name}>{t.name}</div>
                {t.url && (
                  <div className={styles.meta}>
                    {t.url.length > 40
                      ? t.url.slice(0, 40) + "…"
                      : t.url}
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
      </div>

      <div className={styles.footer}>
        <Button 
          variant="primary" 
          className={styles.addBtn}
          onClick={onAddTest} 
          icon={<IconPlus size={18} />}
        >
          Add New Step
        </Button>
      </div>
    </div>
  );
}

export default TestList;
