import { useState, useEffect } from "react";
import { useModules } from "../context/CollectionContext";
import Badge from "./ui/badge/Badge";
import IconButton from "./ui/icon-button/IconButton";
import Button from "./ui/button/Button";
import Modal from "./ui/modal/Modal";
import Input from "./ui/input/Input";
import Tabs from "./ui/tabs/Tabs";
import Textarea from "./ui/textarea/Textarea";
import { api } from "../utils/api";
import Dropdown from "./ui/dropdown/Dropdown";
import { parseCurl } from "../utils/parseCurl";
import { IconStep, IconDelete, IconPlus, IconFlow, IconEdit, IconDuplicate } from "./ui/icons/Icons";
import FlowTrends from "./FlowTrends";
import FlowHistory from "./FlowHistory";
import FlowDependencyGraph from "./FlowDependencyGraph";
import { toast } from "./ui/toast/toast";
import styles from "./TestList.module.css";

function TestList({ onAddTest }) {
  const { 
    selectedFlow, 
    selectedFlowId, 
    selectedStepId, 
    dispatch, 
    deleteStep, 
    duplicateStep,
    fetchSteps,
    updateStep,
    addStep,
    reorderSteps,
    executions
  } = useModules();

  useEffect(() => {
    if (selectedFlowId) {
      fetchSteps(selectedFlowId);
      setActiveTab("steps");
    }
  }, [selectedFlowId]);

  const tests = selectedFlow?.tests || [];

  const flowExecution = executions[selectedFlowId];
  const resultsData = flowExecution?.pollData || flowExecution?.results;
  const stepStatusMap = {};
  if (resultsData && resultsData.steps) {
    resultsData.steps.forEach(step => {
      stepStatusMap[String(step.stepId)] = step;
    });
  }

  const [activeTab, setActiveTab] = useState("steps");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingStep, setEditingStep] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);
  const [orderChanged, setOrderChanged] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

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

    dispatch({
      type: "REORDER_TESTS",
      flowId: selectedFlowId,
      tests: next,
    });
    setOrderChanged(true);
    setDragIndex(null);
    setDropIndex(null);
  }

  async function handleSaveOrder() {
    if (!selectedFlowId || tests.length === 0) return;
    setSavingOrder(true);
    try {
      await reorderSteps(selectedFlowId, tests);
      setOrderChanged(false);
    } catch (err) {
      console.error("Failed to save step order:", err);
      toast.error(`Unable to save step order: ${err.message || err}`);
    } finally {
      setSavingOrder(false);
    }
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

  async function handleDuplicate(e, step) {
    e.stopPropagation();
    const name = prompt("Name for duplicated step:", `${step.name} (copy)`);
    if (!name || !name.trim()) return;
    try {
      await duplicateStep(selectedFlowId, step.id, name.trim());
    } catch (err) {
      toast.error("Failed to duplicate step: " + err.message);
    }
  }

  function handleSelect(stepId) {
    dispatch({ type: "SELECT_STEP", id: stepId });
  }

  function handleAddTest() {
    if (!selectedFlowId) return;
    setShowCreateModal(true);
  }

  function handleDownloadScript() {
    const script = selectedFlow?.playwrightScript;
    if (!script) {
      toast.error("No Playwright script available for this flow.");
      return;
    }
    const safeName = (selectedFlow.name || "ui-flow")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "UiFlow";
    const fileName = `${safeName}.java`;
    try {
      const blob = new Blob([script], { type: "text/x-java-source;charset=utf-8" });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
      toast.success(`Downloaded ${fileName}`);
    } catch (err) {
      toast.error("Failed to download script: " + (err.message || err));
    }
  }

  useEffect(() => {
    setOrderChanged(false);
  }, [selectedFlowId]);

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

  const PANE_TABS = [
    { id: "steps", label: "Steps" },
    { id: "trends", label: "Trends" },
    { id: "history", label: "History" },
    { id: "graph", label: "Graph" }
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
            <h3 className={styles.title} style={{ color: "var(--text-primary)", fontSize: "15px", fontWeight: "800", textTransform: "none", letterSpacing: "normal" }}>
              {selectedFlow.name}
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {selectedFlow.flowType === "UI" && (
                <Button
                  size="small"
                  variant="secondary"
                  onClick={handleDownloadScript}
                  disabled={!selectedFlow.playwrightScript}
                  title={
                    selectedFlow.playwrightScript
                      ? "Download the generated Playwright Java script"
                      : "No Playwright script available for this flow yet"
                  }
                  icon="⬇"
                >
                  Download Script
                </Button>
              )}
              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {activeTab === "steps" ? `${tests.length} steps` : activeTab}
              </span>
            </div>
          </div>
          <Tabs tabs={PANE_TABS} activeTab={activeTab} onChange={setActiveTab} />
        </div>
      </div>

      {activeTab === "steps" && (
        <>
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
                  {stepStatusMap[String(t.id)] && (
                    <span 
                      style={{ 
                        fontSize: '10px', 
                        padding: '4px 8px', 
                        borderRadius: '12px',
                        fontWeight: '600',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        backgroundColor: stepStatusMap[String(t.id)].status === 'PASS' ? 'rgba(16, 185, 129, 0.1)' : 
                                        stepStatusMap[String(t.id)].status === 'FAIL' ? 'rgba(239, 68, 68, 0.1)' : 
                                        stepStatusMap[String(t.id)].status === 'IN_PROGRESS' ? 'rgba(245, 158, 11, 0.1)' : 
                                        'rgba(156, 163, 175, 0.1)',
                        color: stepStatusMap[String(t.id)].status === 'PASS' ? 'var(--status-success)' : 
                               stepStatusMap[String(t.id)].status === 'FAIL' ? 'var(--status-error)' : 
                               stepStatusMap[String(t.id)].status === 'IN_PROGRESS' ? 'var(--status-warning)' : 
                               'var(--text-muted)'
                      }}
                    >
                      {stepStatusMap[String(t.id)].status}
                      {stepStatusMap[String(t.id)].durationMs > 0 && ` (${stepStatusMap[String(t.id)].durationMs}ms)`}
                    </span>
                  )}
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
                      variant="ghost"
                      title="Duplicate step"
                      onClick={(e) => handleDuplicate(e, t)}
                      style={{ marginRight: "4px" }}
                    >
                      <IconDuplicate size={14} />
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
            {orderChanged && (
              <Button
                variant="secondary"
                className={styles.saveBtn}
                onClick={handleSaveOrder}
                disabled={savingOrder}
              >
                {savingOrder ? "Saving order…" : "Save Order"}
              </Button>
            )}
            <Button 
              variant="primary" 
              className={styles.addBtn}
              onClick={handleAddTest} 
              icon={<IconPlus size={18} />}
            >
              Add New Step
            </Button>
          </div>
        </>
      )}

      {activeTab === "trends" && (
        <FlowTrends flowId={selectedFlowId} />
      )}

      {activeTab === "history" && (
        <FlowHistory flowId={selectedFlowId} />
      )}

      {activeTab === "graph" && (
        <FlowDependencyGraph flowId={selectedFlowId} />
      )}
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
  const [initialDelayMs, setInitialDelayMs] = useState(0);
  const [pollUntilSuccess, setPollUntilSuccess] = useState(false);
  const [pollIntervalMs, setPollIntervalMs] = useState(1000);
  const [pollMaxAttempts, setPollMaxAttempts] = useState(5);
  const [pollExpectedStatus, setPollExpectedStatus] = useState(200);
  const [pollConditionLogic, setPollConditionLogic] = useState("AND");
  const [pollConditions, setPollConditions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function addPollConditionCreate() {
    setPollConditions(prev => [...prev, { path: "", operator: "equals", value: "" }]);
  }
  function removePollConditionCreate(idx) {
    setPollConditions(prev => prev.filter((_, i) => i !== idx));
  }
  function updatePollConditionCreate(idx, field, val) {
    setPollConditions(prev => prev.map((c, i) => i === idx ? { ...c, [field]: val } : c));
  }
  function buildPollConditionJsonCreate() {
    const valid = pollConditions.filter(c => c.path.trim());
    if (valid.length === 0) return null;
    return JSON.stringify({ logic: pollConditionLogic, conditions: valid.map(c => ({ path: c.path.trim(), operator: c.operator, value: c.value })) });
  }

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
    if (initialDelayMs < 0 || initialDelayMs > 300000) {
      setError("Initial delay must not exceed 5 minutes (300000 ms).");
      return;
    }
    if (pollUntilSuccess) {
      if (pollIntervalMs <= 0) {
        setError("Poll interval must be greater than 0 ms.");
        return;
      }
      if (pollMaxAttempts <= 0) {
        setError("Max poll attempts must be greater than 0.");
        return;
      }
      if (pollExpectedStatus < 100 || pollExpectedStatus > 599) {
        setError("Expected status code must be between 100 and 599.");
        return;
      }
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
        retryDelayMs: retryDelayMs,
        initialDelayMs: initialDelayMs,
        pollUntilSuccess: pollUntilSuccess,
        pollIntervalMs: pollIntervalMs,
        pollMaxAttempts: pollMaxAttempts,
        pollExpectedStatus: pollExpectedStatus,
        pollConditionJson: buildPollConditionJsonCreate(),
      });
      onClose();
    } catch (err) {
      setError(err.message || "Failed to create step");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Create Step" onClose={onClose} size="lg">
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
              label="Retry Delay (ms)"
              placeholder="e.g. 1000"
              value={retryDelayMs}
              onChange={(e) => {
                setRetryDelayMs(parseInt(e.target.value) || 0);
                setError("");
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <Input
              type="number"
              min="0"
              max="300000"
              step="100"
              label="Initial Delay (ms)"
              placeholder="e.g. 500"
              value={initialDelayMs}
              onChange={(e) => {
                setInitialDelayMs(parseInt(e.target.value) || 0);
                setError("");
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px" }}>
          <input
            type="checkbox"
            id="pollUntilSuccess"
            checked={pollUntilSuccess}
            onChange={(e) => setPollUntilSuccess(e.target.checked)}
            style={{ width: "16px", height: "16px", cursor: "pointer" }}
          />
          <label htmlFor="pollUntilSuccess" style={{ fontWeight: "600", fontSize: "14px", color: "var(--text-primary)", cursor: "pointer" }}>
            Poll Until Success (Repeat request until expected status is met)
          </label>
        </div>

        {pollUntilSuccess && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", gap: "16px" }}>
              <div style={{ flex: 1 }}>
                <Input
                  type="number"
                  min="1"
                  label="Poll Interval (ms)"
                  placeholder="e.g. 1000"
                  value={pollIntervalMs}
                  onChange={(e) => { setPollIntervalMs(parseInt(e.target.value) || 0); setError(""); }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <Input
                  type="number"
                  min="1"
                  label="Max Poll Attempts"
                  placeholder="e.g. 5"
                  value={pollMaxAttempts}
                  onChange={(e) => { setPollMaxAttempts(parseInt(e.target.value) || 0); setError(""); }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <Input
                  type="number"
                  min="100"
                  max="599"
                  label="Expected Status"
                  placeholder="e.g. 200"
                  value={pollExpectedStatus}
                  onChange={(e) => { setPollExpectedStatus(parseInt(e.target.value) || 0); setError(""); }}
                />
              </div>
            </div>

            {/* Poll Body Condition */}
            <div style={{ background: "var(--bg-tertiary, rgba(255,255,255,0.03))", border: "1px solid var(--border-color)", borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)" }}>Body Condition (optional)</span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Logic:</span>
                  <select
                    value={pollConditionLogic}
                    onChange={(e) => setPollConditionLogic(e.target.value)}
                    style={{ fontSize: "12px", padding: "3px 8px", borderRadius: "6px", border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)", cursor: "pointer" }}
                  >
                    <option value="AND">AND — all must match</option>
                    <option value="OR">OR — any must match</option>
                  </select>
                </div>
              </div>
              <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0 }}>Stop polling when the response body also satisfies these conditions (in addition to the status code).</p>
              <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: "4px 0 0 0", fontStyle: "italic" }}>
                💡 Note: Once you save and run this step/flow, you can select response fields from a dropdown when updating settings.
              </p>
              {pollConditions.map((cond, idx) => (
                <div key={idx} style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
                  <div style={{ flex: 2 }}>
                    <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>JSON Path</label>
                    <input
                      type="text"
                      placeholder="e.g. status or order.state"
                      value={cond.path}
                      onChange={(e) => updatePollConditionCreate(idx, "path", e.target.value)}
                      style={{ width: "100%", padding: "7px 10px", borderRadius: "7px", border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: "13px", boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ flex: 1.5 }}>
                    <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Operator</label>
                    <select
                      value={cond.operator}
                      onChange={(e) => updatePollConditionCreate(idx, "operator", e.target.value)}
                      style={{ width: "100%", padding: "7px 10px", borderRadius: "7px", border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: "13px" }}
                    >
                      <option value="equals">equals</option>
                      <option value="notEquals">not equals</option>
                      <option value="contains">contains</option>
                      <option value="greaterThan">greater than</option>
                      <option value="lessThan">less than</option>
                      <option value="exists">exists</option>
                      <option value="in">in (list)</option>
                    </select>
                  </div>
                  <div style={{ flex: 2 }}>
                    <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Value</label>
                    <input
                      type="text"
                      placeholder={cond.operator === "exists" ? "(not needed)" : "e.g. COMPLETED"}
                      value={cond.value}
                      disabled={cond.operator === "exists"}
                      onChange={(e) => updatePollConditionCreate(idx, "value", e.target.value)}
                      style={{ width: "100%", padding: "7px 10px", borderRadius: "7px", border: "1px solid var(--border-color)", background: cond.operator === "exists" ? "var(--bg-tertiary)" : "var(--bg-secondary)", color: "var(--text-primary)", fontSize: "13px", boxSizing: "border-box", opacity: cond.operator === "exists" ? 0.5 : 1 }}
                    />
                  </div>
                  <button
                    onClick={() => removePollConditionCreate(idx)}
                    style={{ padding: "7px 10px", borderRadius: "7px", border: "1px solid var(--border-color)", background: "transparent", color: "var(--status-error)", cursor: "pointer", fontSize: "16px", lineHeight: 1, flexShrink: 0 }}
                    title="Remove condition"
                  >×</button>
                </div>
              ))}
              <button
                onClick={addPollConditionCreate}
                style={{ alignSelf: "flex-start", padding: "6px 14px", borderRadius: "7px", border: "1px dashed var(--border-color)", background: "transparent", color: "var(--accent-primary)", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}
              >+ Add Condition</button>
            </div>
          </div>
        )}

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
  const [initialDelayMs, setInitialDelayMs] = useState(step.initialDelayMs || 0);
  const [pollUntilSuccess, setPollUntilSuccess] = useState(step.pollUntilSuccess || false);
  const [pollIntervalMs, setPollIntervalMs] = useState(step.pollIntervalMs || 1000);
  const [pollMaxAttempts, setPollMaxAttempts] = useState(step.pollMaxAttempts || 5);
  const [pollExpectedStatus, setPollExpectedStatus] = useState(step.pollExpectedStatus || 200);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Parse existing pollConditionJson if present
  const parsedPollCond = (() => {
    try { return step.pollConditionJson ? JSON.parse(step.pollConditionJson) : null; } catch { return null; }
  })();
  const [pollConditionLogic, setPollConditionLogic] = useState(parsedPollCond?.logic || "AND");
  const [pollConditions, setPollConditions] = useState(parsedPollCond?.conditions || []);

  const [availableFields, setAvailableFields] = useState(null);
  const [fieldsError, setFieldsError] = useState("");
  const [loadingFields, setLoadingFields] = useState(false);
  const [customPathMode, setCustomPathMode] = useState({});

  useEffect(() => {
    if (pollUntilSuccess && step.id) {
      setLoadingFields(true);
      setFieldsError("");
      api.getPollFields(flowId, step.id)
        .then(data => {
          setAvailableFields(data || {});
        })
        .catch(err => {
          console.error("Failed to load poll fields:", err);
          setFieldsError("Run the flow once to get the variables");
        })
        .finally(() => {
          setLoadingFields(false);
        });
    }
  }, [pollUntilSuccess, flowId, step.id]);

  function addPollConditionUpdate() {
    setPollConditions(prev => [...prev, { path: "", operator: "equals", value: "" }]);
  }
  function removePollConditionUpdate(idx) {
    setPollConditions(prev => prev.filter((_, i) => i !== idx));
  }
  function updatePollConditionUpdate(idx, field, val) {
    setPollConditions(prev => prev.map((c, i) => i === idx ? { ...c, [field]: val } : c));
  }
  function buildPollConditionJsonUpdate() {
    const valid = pollConditions.filter(c => c.path.trim());
    if (valid.length === 0) return null;
    return JSON.stringify({ logic: pollConditionLogic, conditions: valid.map(c => ({ path: c.path.trim(), operator: c.operator, value: c.value })) });
  }

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
    if (initialDelayMs < 0 || initialDelayMs > 300000) {
      setError("Initial delay must not exceed 5 minutes (300000 ms).");
      return;
    }
    if (pollUntilSuccess) {
      if (pollIntervalMs <= 0) {
        setError("Poll interval must be greater than 0 ms.");
        return;
      }
      if (pollMaxAttempts <= 0) {
        setError("Max poll attempts must be greater than 0.");
        return;
      }
      if (pollExpectedStatus < 100 || pollExpectedStatus > 599) {
        setError("Expected status code must be between 100 and 599.");
        return;
      }
    }
    setLoading(true);
    setError("");
    try {
      await updateStep(flowId, step.id, {
        name: name.trim(),
        description: description.trim(),
        retryCount: retryCount,
        retryDelayMs: retryDelayMs,
        initialDelayMs: initialDelayMs,
        pollUntilSuccess: pollUntilSuccess,
        pollIntervalMs: pollIntervalMs,
        pollMaxAttempts: pollMaxAttempts,
        pollExpectedStatus: pollExpectedStatus,
        pollConditionJson: buildPollConditionJsonUpdate(),
      });
      toast.success("Step updated");
      onClose();
    } catch (err) {
      setError(err.message || "Failed to update step");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Update Step Settings" onClose={onClose} size="lg">
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
              label="Retry Delay (ms)"
              placeholder="e.g. 1000"
              value={retryDelayMs}
              onChange={(e) => {
                setRetryDelayMs(parseInt(e.target.value) || 0);
                setError("");
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <Input
              type="number"
              min="0"
              max="300000"
              step="100"
              label="Initial Delay (ms)"
              placeholder="e.g. 500"
              value={initialDelayMs}
              onChange={(e) => {
                setInitialDelayMs(parseInt(e.target.value) || 0);
                setError("");
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px" }}>
          <input
            type="checkbox"
            id="updatePollUntilSuccess"
            checked={pollUntilSuccess}
            onChange={(e) => setPollUntilSuccess(e.target.checked)}
            style={{ width: "16px", height: "16px", cursor: "pointer" }}
          />
          <label htmlFor="updatePollUntilSuccess" style={{ fontWeight: "600", fontSize: "14px", color: "var(--text-primary)", cursor: "pointer" }}>
            Poll Until Success (Repeat request until expected status is met)
          </label>
        </div>

        {pollUntilSuccess && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", gap: "16px" }}>
              <div style={{ flex: 1 }}>
                <Input
                  type="number"
                  min="1"
                  label="Poll Interval (ms)"
                  placeholder="e.g. 1000"
                  value={pollIntervalMs}
                  onChange={(e) => { setPollIntervalMs(parseInt(e.target.value) || 0); setError(""); }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <Input
                  type="number"
                  min="1"
                  label="Max Poll Attempts"
                  placeholder="e.g. 5"
                  value={pollMaxAttempts}
                  onChange={(e) => { setPollMaxAttempts(parseInt(e.target.value) || 0); setError(""); }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <Input
                  type="number"
                  min="100"
                  max="599"
                  label="Expected Status"
                  placeholder="e.g. 200"
                  value={pollExpectedStatus}
                  onChange={(e) => { setPollExpectedStatus(parseInt(e.target.value) || 0); setError(""); }}
                />
              </div>
            </div>

            {/* Poll Body Condition */}
            <div style={{ background: "var(--bg-tertiary, rgba(255,255,255,0.03))", border: "1px solid var(--border-color)", borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)" }}>Body Condition (optional)</span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Logic:</span>
                  <select
                    value={pollConditionLogic}
                    onChange={(e) => setPollConditionLogic(e.target.value)}
                    style={{ fontSize: "12px", padding: "3px 8px", borderRadius: "6px", border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)", cursor: "pointer" }}
                  >
                    <option value="AND">AND — all must match</option>
                    <option value="OR">OR — any must match</option>
                  </select>
                </div>
              </div>
              <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0 }}>Stop polling when the response body also satisfies these conditions (in addition to the status code).</p>
              {loadingFields && (
                <span style={{ fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic" }}>Loading response fields...</span>
              )}
              {fieldsError && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", margin: "4px 0", padding: "6px 10px", borderRadius: "6px", background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.2)" }}>
                  <span style={{ color: "var(--status-warning, #f59e0b)", fontSize: "11px", fontWeight: "600" }}>
                    ⚠️ {fieldsError}
                  </span>
                </div>
              )}
              {pollConditions.map((cond, idx) => {
                const showDropdown = availableFields && !customPathMode[idx];
                const dropdownOptions = Object.keys(availableFields || {}).map(path => ({
                  label: `${path} (${availableFields[path]})`,
                  value: path
                }));

                return (
                  <div key={idx} style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
                    <div style={{ flex: 2 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <label style={{ fontSize: "11px", color: "var(--text-muted)" }}>JSON Path</label>
                        {showDropdown ? (
                          <button 
                            type="button" 
                            onClick={() => setCustomPathMode(prev => ({ ...prev, [idx]: true }))}
                            style={{ background: "none", border: "none", color: "var(--accent-primary, #10b981)", cursor: "pointer", fontSize: "10px", padding: 0 }}
                          >
                            Type manually
                          </button>
                        ) : (
                          availableFields && (
                            <button 
                              type="button" 
                              onClick={() => setCustomPathMode(prev => ({ ...prev, [idx]: false }))}
                              style={{ background: "none", border: "none", color: "var(--accent-primary, #10b981)", cursor: "pointer", fontSize: "10px", padding: 0 }}
                            >
                              Select from list
                            </button>
                          )
                        )}
                      </div>
                      {showDropdown ? (
                        <Dropdown
                          options={dropdownOptions}
                          value={cond.path}
                          onChange={(val) => updatePollConditionUpdate(idx, "path", val)}
                          placeholder={cond.path || "Select JSON Path..."}
                        />
                      ) : (
                        <input
                          type="text"
                          placeholder="e.g. status or order.state"
                          value={cond.path}
                          onChange={(e) => updatePollConditionUpdate(idx, "path", e.target.value)}
                          style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: "13px", boxSizing: "border-box" }}
                        />
                      )}
                    </div>
                  <div style={{ flex: 1.5 }}>
                    <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Operator</label>
                    <select
                      value={cond.operator}
                      onChange={(e) => updatePollConditionUpdate(idx, "operator", e.target.value)}
                      style={{ width: "100%", padding: "7px 10px", borderRadius: "7px", border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: "13px" }}
                    >
                      <option value="equals">equals</option>
                      <option value="notEquals">not equals</option>
                      <option value="contains">contains</option>
                      <option value="greaterThan">greater than</option>
                      <option value="lessThan">less than</option>
                      <option value="exists">exists</option>
                      <option value="in">in (list)</option>
                    </select>
                  </div>
                  <div style={{ flex: 2 }}>
                    <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Value</label>
                    <input
                      type="text"
                      placeholder={cond.operator === "exists" ? "(not needed)" : "e.g. COMPLETED"}
                      value={cond.value}
                      disabled={cond.operator === "exists"}
                      onChange={(e) => updatePollConditionUpdate(idx, "value", e.target.value)}
                      style={{ width: "100%", padding: "7px 10px", borderRadius: "7px", border: "1px solid var(--border-color)", background: cond.operator === "exists" ? "var(--bg-tertiary)" : "var(--bg-secondary)", color: "var(--text-primary)", fontSize: "13px", boxSizing: "border-box", opacity: cond.operator === "exists" ? 0.5 : 1 }}
                    />
                  </div>
                  <button
                    onClick={() => removePollConditionUpdate(idx)}
                    style={{ padding: "7px 10px", borderRadius: "7px", border: "1px solid var(--border-color)", background: "transparent", color: "var(--status-error)", cursor: "pointer", fontSize: "16px", lineHeight: 1, flexShrink: 0 }}
                    title="Remove condition"
                  >×</button>
                </div>
                );
              })}
              <button
                onClick={addPollConditionUpdate}
                style={{ alignSelf: "flex-start", padding: "6px 14px", borderRadius: "7px", border: "1px dashed var(--border-color)", background: "transparent", color: "var(--accent-primary)", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}
              >+ Add Condition</button>
            </div>
          </div>
        )}

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
