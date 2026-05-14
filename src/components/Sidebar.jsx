import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useModules } from "../context/CollectionContext";

import Badge from "./ui/badge/Badge";
import IconButton from "./ui/icon-button/IconButton";
import { IconFlow, IconPlay, IconDelete, IconChevron, IconPlus, IconDuplicate, IconReport, IconPlus as IconImport } from "./ui/icons/Icons";
import Modal from "./ui/modal/Modal";
import Input from "./ui/input/Input";
import Textarea from "./ui/textarea/Textarea";
import Button from "./ui/button/Button";
import styles from "./Sidebar.module.css";

function Sidebar() {
  const navigate = useNavigate();
  const {
    selectedModule,
    selectedModuleId,
    selectedFlowId,
    selectedStepId,
    selectedEnvId,
    dispatch,
    deleteFlow,
    updateFlow,
    duplicateFlow,
    fetchFlows,
    fetchSteps,
    executeFlow,
    executions,
    createFlow,
  } = useModules();

  useEffect(() => {
    if (selectedFlowId) fetchSteps(selectedFlowId);
  }, [selectedFlowId]);

  useEffect(() => {
    if (selectedModuleId) fetchFlows(selectedModuleId);
  }, [selectedModuleId]);

  const [expanded, setExpanded] = useState(() => {
    const set = new Set();
    if (selectedFlowId) set.add(selectedFlowId);
    return set;
  });

  const [editingFlow, setEditingFlow] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [showCreateFlow, setShowCreateFlow] = useState(false);

  function toggleExpand(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSelectFlow(id) {
    dispatch({ type: "SELECT_FLOW", id });
    setExpanded((prev) => new Set(prev).add(id));
  }

  function handleSelectTest(flowId, stepId) {
    if (selectedFlowId !== flowId) dispatch({ type: "SELECT_FLOW", id: flowId });
    dispatch({ type: "SELECT_STEP", id: stepId });
  }

  function handleDeleteFlow(e, id) {
    e.stopPropagation();
    if (confirm("Delete this flow?")) {
      deleteFlow(selectedModuleId, id);
    }
  }

  async function handleDuplicateFlow(e, flow) {
    e.stopPropagation();
    const name = prompt("Name for duplicated flow:", `${flow.name} (copy)`);
    if (!name) return;
    try {
      await duplicateFlow(selectedModuleId, flow.id, name);
    } catch (err) {
      alert("Failed to duplicate flow: " + err.message);
    }
  }

  async function handleRunFlow(e, flow) {
    e.stopPropagation();
    if (executions[flow.id]?.status === "running") return;

    try {
      const results = await executeFlow(flow.id, selectedEnvId);

      results?.stepResults?.forEach((res) => {
        dispatch({
          type: "UPDATE_STEP",
          flowId: flow.id,
          stepId: res.stepId,
          patch: {
            response: {
              status: res.statusCode,
              statusText: res.success ? "OK" : res.errorMessage || "Error",
              time: res.durationMs,
              body: res.responseBody,
              headers: [],
              resolvedUrl: res.resolvedUrl,
              resolvedHeaders: res.resolvedHeadersJson
                ? JSON.parse(res.resolvedHeadersJson)
                : null,
              resolvedBody: res.resolvedBodyJson,
            },
          },
        });
      });
    } catch (err) {
      // Error handled in executeFlow
    }
  }

  if (!selectedModule) return null;

  const flows = selectedModule.flows;

  return (
    <div className={styles.sidebar}>
      <div className={styles.flows}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Flows</span>
          <div className={styles.sectionActions}>
            <IconButton
              size="small"
              onClick={() => setShowImport(true)}
              title="Import Postman"
            >
              <IconImport size={16} />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => setShowCreateFlow(true)}
              title="Create Flow"
            >
              <IconPlus size={16} />
            </IconButton>
          </div>
        </div>

        {flows === null && <div className={styles.loading}>Loading flows...</div>}

        {(flows || []).map((flow) => {
          const isActive = flow.id === selectedFlowId;
          const isOpen = expanded.has(flow.id);
          const exec = executions[flow.id];

          return (
            <div
              key={flow.id}
              className={`${styles.collection} ${isActive ? styles.active : ""}`}
            >
              <div
                className={styles.collectionHeader}
                onClick={() => {
                  handleSelectFlow(flow.id);
                  toggleExpand(flow.id);
                }}
              >
                <div className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}>
                  <IconChevron size={14} />
                </div>
                <IconFlow size={20} className={styles.collectionIcon} />
                <div className={styles.collectionInfo}>
                  <div className={styles.collectionName}>{flow.name || "Untitled Flow"}</div>
                  {flow.description && (
                    <div className={styles.collectionMeta}>{flow.description}</div>
                  )}
                </div>

                <div className={styles.actions}>
                  <IconButton
                    size="small"
                    variant="secondary"
                    title="Edit flow"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingFlow(flow);
                    }}
                  >
                    <IconPlus size={14} style={{ transform: "rotate(45deg)" }} />
                  </IconButton>

                  <IconButton
                    size="small"
                    variant="secondary"
                    title="Duplicate flow"
                    onClick={(e) => handleDuplicateFlow(e, flow)}
                  >
                    <IconDuplicate size={14} />
                  </IconButton>

                  <IconButton
                    size="small"
                    variant="primary"
                    title="Run Flow"
                    onClick={(e) => handleRunFlow(e, flow)}
                    disabled={exec?.status === "running"}
                    className={exec?.status === "running" ? styles.running : ""}
                  >
                    {exec?.status === "running" ? (
                      <span className={styles.spinner} />
                    ) : exec?.status === "done" ? (
                      <span
                        className={
                          exec.results?.success || exec.results?.allStepsPassed
                            ? styles.passText
                            : styles.failText
                        }
                      >
                        {exec.results?.success || exec.results?.allStepsPassed ? "✓" : "✗"}
                      </span>
                    ) : (
                      <IconPlay size={14} />
                    )}
                  </IconButton>

                  {exec?.status === "done" && (
                    <IconButton
                      size="small"
                      variant="secondary"
                      title="View Report"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/report?type=flow&id=${flow.id}`);
                      }}
                    >
                      <IconReport size={14} />
                    </IconButton>
                  )}

                  <IconButton
                    size="small"
                    variant="danger"
                    title="Delete flow"
                    className={styles.deleteBtn}
                    onClick={(e) => handleDeleteFlow(e, flow.id)}
                  >
                    <IconDelete size={14} />
                  </IconButton>
                </div>
              </div>

              {isOpen && (flow.tests || []).length > 0 && (
                <div className={styles.testItems}>
                  {flow.tests.map((t) => (
                    <div
                      key={t.id}
                      className={`${styles.testItem} ${t.id === selectedStepId ? styles.activeTest : ""}`}
                      onClick={() => handleSelectTest(flow.id, t.id)}
                    >
                      <Badge variant={t.method?.toLowerCase() || "get"}>
                        {t.method || "GET"}
                      </Badge>
                      <span className={styles.testItemName}>{t.name}</span>
                    </div>
                  ))}
                </div>
              )}
              {isOpen && (flow.tests || []).length === 0 && (
                <div className={styles.testItems}>
                  <div className={styles.emptyTests}>No steps yet.</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editingFlow && (
        <UpdateFlowModal
          moduleId={selectedModuleId}
          flow={editingFlow}
          onClose={() => setEditingFlow(null)}
        />
      )}
      {showImport && (
        <ImportFlowModal
          moduleId={selectedModuleId}
          onClose={() => setShowImport(false)}
        />
      )}
      {showCreateFlow && (
        <CreateFlowModal
          moduleId={selectedModuleId}
          onClose={() => setShowCreateFlow(false)}
        />
      )}
    </div>
  );
}

function CreateFlowModal({ moduleId, onClose }) {
  const { createFlow } = useModules();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await createFlow(moduleId, { name: name.trim() });
      onClose();
    } catch (err) {
      alert("Failed to create flow: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Create Flow" onClose={onClose} size="sm">
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <Input
          label="Flow Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={loading}>{loading ? "Creating..." : "Create"}</Button>
        </div>
      </div>
    </Modal>
  );
}

function UpdateFlowModal({ moduleId, flow, onClose }) {
  const { updateFlow, setFlowEnvironment, selectedModule } = useModules();
  const [name, setName] = useState(flow.name);
  const [desc, setDesc] = useState(flow.description || "");
  const [envId, setEnvId] = useState(flow.defaultEnvironmentId || "");
  const [loading, setLoading] = useState(false);

  async function handleUpdate() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await updateFlow(moduleId, flow.id, { name: name.trim(), description: desc.trim() });
      if (envId !== (flow.defaultEnvironmentId || "")) {
        await setFlowEnvironment(flow.id, envId || null);
      }
      onClose();
    } catch (err) {
      alert("Failed to update flow: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Update Flow" onClose={onClose} size="sm">
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <Input
          label="Flow Name"
          placeholder="e.g. User Signup, Forgot Password"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <Textarea
          label="Description"
          placeholder="What scenarios does this flow cover?"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={3}
        />

        <div className={styles.formGroup}>
          <label className={styles.label}>Default Environment</label>
          <select
            className={styles.select}
            value={envId}
            onChange={(e) => setEnvId(e.target.value)}
          >
            <option value="">None (No default)</option>
            {(selectedModule?.environments || []).map((env) => (
              <option key={env.id} value={env.id}>
                {env.name}
              </option>
            ))}
          </select>
          <p className={styles.helpText}>
            Steps will use this environment by default when running.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleUpdate} disabled={loading}>
            {loading ? "Updating..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ImportFlowModal({ moduleId, onClose }) {
  const { importFlow } = useModules();
  const [flowName, setFlowName] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleImport() {
    if (!flowName || !file) {
      alert("Please enter a flow name and select a file.");
      return;
    }
    setLoading(true);
    try {
      await importFlow(moduleId, file, flowName);
      onClose();
    } catch (err) {
      alert("Import failed: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Import Postman Collection" onClose={onClose} size="sm">
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <Input
          label="Flow Name"
          placeholder="e.g. Authentication"
          value={flowName}
          onChange={(e) => setFlowName(e.target.value)}
        />

        <div className={styles.formGroup}>
          <label className={styles.label}>Postman JSON File</label>
          <input
            type="file"
            accept=".json"
            onChange={(e) => setFile(e.target.files[0])}
            className={styles.fileInput}
          />
        </div>

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleImport} disabled={loading}>
            {loading ? "Importing..." : "Import"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default Sidebar;