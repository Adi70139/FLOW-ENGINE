import { useState, useEffect } from "react";
import { useModules } from "../context/CollectionContext";
import Badge from "./ui/badge/Badge";
import IconButton from "./ui/icon-button/IconButton";
import Button from "./ui/button/Button";
import Modal from "./ui/modal/Modal";
import Input from "./ui/input/Input";
import Tabs from "./ui/tabs/Tabs";
import Textarea from "./ui/textarea/Textarea";
import { parseCurl } from "../utils/parseCurl";
import { IconStep, IconDelete, IconPlus, IconFlow, IconEdit } from "./ui/icons/Icons";
import styles from "./TestList.module.css";

function TestList({ onAddTest }) {
  const { 
    selectedFlow, 
    selectedFlowId, 
    selectedStepId, 
    dispatch, 
    deleteStep, 
    fetchSteps,
    updateStep,
    addStep
  } = useModules();

  useEffect(() => {
    if (selectedFlowId) {
      fetchSteps(selectedFlowId);
    }
  }, [selectedFlowId]);

  const tests = selectedFlow?.tests || [];

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingStep, setEditingStep] = useState(null);
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

  function handleAddTest() {
    if (!selectedFlowId) return;
    setShowCreateModal(true);
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
                  variant="ghost"
                  title="Edit step details"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingStep(t);
                  }}
                  style={{ marginRight: "4px" }}
                >
                  <IconEdit size={14} />
                </IconButton>
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
          onClick={handleAddTest} 
          icon={<IconPlus size={18} />}
        >
          Add New Step
        </Button>
      </div>
      {showCreateModal && (
        <CreateStepModal 
          flowId={selectedFlowId} 
          addStep={addStep} 
          onClose={() => setShowCreateModal(false)} 
        />
      )}
      {editingStep && (
        <UpdateStepModal
          step={editingStep}
          flowId={selectedFlowId}
          updateStep={updateStep}
          onClose={() => setEditingStep(null)}
        />
      )}
    </div>
  );
}

function CreateStepModal({ onClose, flowId, addStep }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [retryDelayMs, setRetryDelayMs] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!name.trim()) return;
    if (retryCount < 0 || retryCount > 8) {
      setError("Retry count must be between 0 and 8.");
      return;
    }
    if (retryDelayMs < 0 || retryDelayMs > 20000) {
      setError("Retry delay must not exceed 20 seconds (20000 ms).");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await addStep(flowId, {
        name: name.trim(),
        description: description.trim(),
        method: "GET",
        endpoint: "https://api.example.com",
        headers: [],
        payload: "",
        retryCount: retryCount,
        retryDelayMs: retryDelayMs
      });
      onClose();
    } catch (err) {
      setError(err.message || "Failed to create step");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Create Step" onClose={onClose} size="sm">
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <Input
          label="Step Name"
          placeholder="e.g. Get User Profile"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
          autoFocus
        />

        <Textarea
          label="Description"
          placeholder="What does this step do?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />

        <div style={{ display: "flex", gap: "16px" }}>
          <div style={{ flex: 1 }}>
            <Input
              type="number"
              min="0"
              max="8"
              label="Retry Count (0-8)"
              placeholder="e.g. 3"
              value={retryCount}
              onChange={(e) => {
                setRetryCount(parseInt(e.target.value) || 0);
                setError("");
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <Input
              type="number"
              min="0"
              max="20000"
              step="100"
              label="Retry Delay (max 20s)"
              placeholder="e.g. 1000"
              value={retryDelayMs}
              onChange={(e) => {
                setRetryDelayMs(parseInt(e.target.value) || 0);
                setError("");
              }}
            />
          </div>
        </div>

        {error && (
          <span style={{ color: "var(--status-error)", fontSize: "var(--text-sm)" }}>
            {error}
          </span>
        )}

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleCreate} disabled={loading}>{loading ? "Creating..." : "Create"}</Button>
        </div>
      </div>
    </Modal>
  );
}

function UpdateStepModal({ step, flowId, updateStep, onClose }) {
  const [name, setName] = useState(step.name || "");
  const [description, setDescription] = useState(step.description || "");
  const [retryCount, setRetryCount] = useState(step.retryCount || 0);
  const [retryDelayMs, setRetryDelayMs] = useState(step.retryDelayMs || 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!name.trim()) return;
    if (retryCount < 0 || retryCount > 8) {
      setError("Retry count must be between 0 and 8.");
      return;
    }
    if (retryDelayMs < 0 || retryDelayMs > 20000) {
      setError("Retry delay must not exceed 20 seconds (20000 ms).");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await updateStep(flowId, step.id, {
        name: name.trim(),
        description: description.trim(),
        retryCount: retryCount,
        retryDelayMs: retryDelayMs,
      });
      onClose();
    } catch (err) {
      setError(err.message || "Failed to update step");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Update Step Settings" onClose={onClose} size="sm">
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <Input
          label="Step Name"
          placeholder="e.g. Get User Profile"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
          autoFocus
        />

        <Textarea
          label="Description"
          placeholder="What does this step do?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />

        <div style={{ display: "flex", gap: "16px" }}>
          <div style={{ flex: 1 }}>
            <Input
              type="number"
              min="0"
              max="8"
              label="Retry Count (0-8)"
              placeholder="e.g. 3"
              value={retryCount}
              onChange={(e) => {
                setRetryCount(parseInt(e.target.value) || 0);
                setError("");
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <Input
              type="number"
              min="0"
              max="20000"
              step="100"
              label="Retry Delay (max 20s)"
              placeholder="e.g. 1000"
              value={retryDelayMs}
              onChange={(e) => {
                setRetryDelayMs(parseInt(e.target.value) || 0);
                setError("");
              }}
            />
          </div>
        </div>

        {error && (
          <span style={{ color: "var(--status-error)", fontSize: "var(--text-sm)" }}>
            {error}
          </span>
        )}

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading}>{loading ? "Saving..." : "Save Changes"}</Button>
        </div>
      </div>
    </Modal>
  );
}

export default TestList;
