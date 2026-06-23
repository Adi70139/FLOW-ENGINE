import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useModules } from "../context/CollectionContext";

import Badge from "./ui/badge/Badge";
import IconButton from "./ui/icon-button/IconButton";
import { IconFlow, IconPlay, IconDelete, IconChevron, IconPlus, IconDuplicate, IconReport, IconEdit, IconPlus as IconImport, IconRecord } from "./ui/icons/Icons";
import Modal from "./ui/modal/Modal";
import Input from "./ui/input/Input";
import Textarea from "./ui/textarea/Textarea";
import Button from "./ui/button/Button";
import { toast } from "./ui/toast/toast";
import RecordFlowModal from "./RecordFlowModal";
import CreateUIFlowModal from "./CreateUIFlowModal";
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
    executeBulkWithPolling,
    executions,
    addFlow,
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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeDropdownFlowId, setActiveDropdownFlowId] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [showRecord, setShowRecord] = useState(false);
  const [showCreateFlow, setShowCreateFlow] = useState(false);
  const [showCreateUiFlow, setShowCreateUiFlow] = useState(false);
  const [selectedFlows, setSelectedFlows] = useState(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);

  useEffect(() => {
    function closeDropdowns() {
      setActiveDropdownFlowId(null);
    }
    window.addEventListener("click", closeDropdowns);
    return () => window.removeEventListener("click", closeDropdowns);
  }, []);

  function toggleFlowSelection(e, flowId) {
    e.stopPropagation();
    setSelectedFlows(prev => {
      const next = new Set(prev);
      if (next.has(flowId)) next.delete(flowId);
      else next.add(flowId);
      return next;
    });
  }

  function toggleSelectAll() {
    const flows = selectedModule?.flows || [];
    if (selectedFlows.size === flows.length) {
      setSelectedFlows(new Set());
    } else {
      setSelectedFlows(new Set(flows.map(f => f.id)));
    }
  }

  async function handleBulkFlowRun() {
    if (selectedFlows.size === 0 || bulkRunning) return;
    setBulkRunning(true);
    const flows = selectedModule?.flows || [];
    const ids = Array.from(selectedFlows);
    const envIds = ids.map(id => {
      const flow = flows.find(f => f.id === id);
      return flow?.defaultEnvironmentId || null;
    });

    try {
      await executeBulkWithPolling("flow", ids, envIds);
      navigate("/report?type=bulk");
    } catch (err) {
      toast.error("Bulk flow run failed: " + err.message);
    } finally {
      setBulkRunning(false);
    }
  }

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
      toast.error("Failed to duplicate flow: " + err.message);
    }
  }

  async function handleRunFlow(e, flow) {
    e.stopPropagation();
    if (executions[flow.id]?.status === "running") return;

    try {
      await executeFlow(flow.id, selectedEnvId);
      // stepResults is no longer returned by the async polling API. 
      // Status is automatically tracked via executions[flow.id].pollData
    } catch (err) {
      // Error handled in executeFlow
    }
  }

  if (!selectedModule) return null;

  const flows = selectedModule.flows;

  if (isCollapsed) {
    return (
      <div className={`${styles.sidebar} ${styles.sidebarCollapsed}`}>
        <div className={styles.sidebarCollapsedContent}>
          <button
            type="button"
            className={styles.sidebarExpandAction}
            onClick={() => setIsCollapsed(false)}
            title="Expand Sidebar"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="13 17 18 12 13 7" />
              <polyline points="6 17 11 12 6 7" />
            </svg>
          </button>
          <div className={styles.collapsedRotatedText}>FLOWS</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.sidebar}>
      <div className={styles.flows}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionToolbar}>
            <button
              type="button"
              className={`${styles.toolbarBtn} ${styles.recordBtn}`}
              onClick={() => setShowRecord(true)}
              title="Record API calls from a browser session"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
                <circle cx="12" cy="12" r="8"/>
              </svg>
              <span>Record</span>
            </button>
            <button
              type="button"
              className={styles.toolbarBtn}
              onClick={() => setShowImport(true)}
              title="Import Postman Collection"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span>Import</span>
            </button>
            <button
              type="button"
              className={styles.toolbarBtn}
              onClick={() => setShowCreateUiFlow(true)}
              title="Create UI Automation Flow"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              <span>UI Flow</span>
            </button>
            <button
              type="button"
              className={`${styles.toolbarBtn} ${styles.newBtn}`}
              onClick={() => setShowCreateFlow(true)}
              title="Create New Flow"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              <span>New</span>
            </button>
          </div>
          <div className={styles.sectionLabelRow}>
            <span className={styles.sectionTitle}>Flows</span>
            <button
              type="button"
              className={styles.collapseBtn}
              onClick={() => setIsCollapsed(true)}
              title="Collapse Sidebar"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="11 17 6 12 11 7"/>
                <polyline points="18 17 13 12 18 7"/>
              </svg>
            </button>
          </div>
        </div>

        {(selectedModule?.flows || []).length > 0 && (
          <div className={styles.bulkBar}>
            <label className={styles.selectAllLabel} onClick={toggleSelectAll}>
              <input
                type="checkbox"
                checked={selectedFlows.size === (selectedModule?.flows || []).length && selectedFlows.size > 0}
                onChange={toggleSelectAll}
                className={styles.flowCheckbox}
              />
              <span>Select All ({selectedFlows.size}/{(selectedModule?.flows || []).length})</span>
            </label>
            {selectedFlows.size > 0 && (
              <Button
                size="small"
                onClick={handleBulkFlowRun}
                disabled={bulkRunning}
                icon={bulkRunning ? <span className={styles.spinner} /> : <IconPlay size={14} />}
              >
                {bulkRunning ? "Running..." : `Run ${selectedFlows.size} Flow${selectedFlows.size > 1 ? "s" : ""}`}
              </Button>
            )}
          </div>
        )}

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
                <input
                  type="checkbox"
                  className={styles.flowCheckbox}
                  checked={selectedFlows.has(flow.id)}
                  onChange={(e) => toggleFlowSelection(e, flow.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                {/* <div className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}>
                  <IconChevron size={14} />
                </div> */}
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
                          exec.results?.status === "PASS" || exec.results?.success || exec.results?.allStepsPassed || (exec.results?.steps && exec.results.steps.every(s => s.status === "PASS"))
                            ? styles.passText
                            : styles.failText
                        }
                      >
                        {exec.results?.status === "PASS" || exec.results?.success || exec.results?.allStepsPassed || (exec.results?.steps && exec.results.steps.every(s => s.status === "PASS")) ? "✓" : "✗"}
                      </span>
                    ) : (
                      <IconPlay size={14} />
                    )}
                  </IconButton>

                  <div className={styles.moreMenuContainer}>
                    <IconButton
                      size="small"
                      variant="secondary"
                      title="More actions"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDropdownFlowId(activeDropdownFlowId === flow.id ? null : flow.id);
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="1.5" />
                        <circle cx="12" cy="5" r="1.5" />
                        <circle cx="12" cy="19" r="1.5" />
                      </svg>
                    </IconButton>

                    {activeDropdownFlowId === flow.id && (
                      <div className={styles.moreDropdown} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className={styles.moreOption}
                          onClick={(e) => {
                            setEditingFlow(flow);
                            setActiveDropdownFlowId(null);
                          }}
                        >
                          <IconEdit size={14} />
                          Edit Flow
                        </button>
                        <button
                          type="button"
                          className={styles.moreOption}
                          onClick={(e) => {
                            handleDuplicateFlow(e, flow);
                            setActiveDropdownFlowId(null);
                          }}
                        >
                          <IconDuplicate size={14} />
                          Duplicate
                        </button>
                        {exec?.status === "done" && (
                          <button
                            type="button"
                            className={styles.moreOption}
                            onClick={(e) => {
                              navigate(`/report?type=flow&id=${flow.id}`);
                              setActiveDropdownFlowId(null);
                            }}
                          >
                            <IconReport size={14} />
                            View Report
                          </button>
                        )}
                        <div className={styles.moreDivider} />
                        <button
                          type="button"
                          className={`${styles.moreOption} ${styles.moreOptionDanger}`}
                          onClick={(e) => {
                            handleDeleteFlow(e, flow.id);
                            setActiveDropdownFlowId(null);
                          }}
                        >
                          <IconDelete size={14} />
                          Delete Flow
                        </button>
                      </div>
                    )}
                  </div>
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
      {showRecord && (
        <RecordFlowModal
          defaultModuleId={selectedModuleId}
          onClose={() => setShowRecord(false)}
        />
      )}
      {showCreateFlow && (
        <CreateFlowModal
          moduleId={selectedModuleId}
          onClose={() => setShowCreateFlow(false)}
        />
      )}
      {showCreateUiFlow && (
        <CreateUIFlowModal
          defaultModuleId={selectedModuleId}
          onClose={() => setShowCreateUiFlow(false)}
        />
      )}
    </div>
  );
}

function CreateFlowModal({ moduleId, onClose }) {
  const { addFlow } = useModules();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await addFlow(moduleId, name.trim(), desc.trim());
      onClose();
    } catch (err) {
      toast.error("Failed to create flow: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Create Flow" onClose={onClose} size="sm">
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <Input
          label="Flow Name"
          placeholder="e.g. Authentication Flow"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <Textarea
          label="Description"
          placeholder="Describe the purpose of this flow..."
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={3}
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
  const { setFlowEnvironment, updateFlow, selectedModule } = useModules();
  const [name, setName] = useState(flow.name || "");
  const [desc, setDesc] = useState(flow.description || "");
  const [envId, setEnvId] = useState(flow.defaultEnvironmentId || "");
  const [loading, setLoading] = useState(false);

  async function handleUpdate() {
    setLoading(true);
    try {
      // Update name/description if changed
      const newName = name.trim();
      const newDesc = desc.trim();
      if (newName !== flow.name || newDesc !== (flow.description || "")) {
        if (!newName) { toast.error("Flow name cannot be empty."); setLoading(false); return; }
        await updateFlow(moduleId, flow.id, { name: newName, description: newDesc });
      }
      // Update env if changed
      if (envId !== (flow.defaultEnvironmentId || "")) {
        await setFlowEnvironment(flow.id, envId || null);
      }
      onClose();
    } catch (err) {
      toast.error("Failed to update flow: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Update Flow" onClose={onClose} size="sm">
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <Input
          label="Flow Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Textarea
          label="Description"
          placeholder="Describe the purpose of this flow..."
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
  const [importType, setImportType] = useState("postman");
  const [flowName, setFlowName] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleImport() {
    if (!flowName || !file) {
      toast.error("Please enter a flow name and select a file.");
      return;
    }
    setLoading(true);
    try {
      await importFlow(moduleId, file, flowName, importType);
      onClose();
    } catch (err) {
      toast.error("Import failed: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  const typeLabel =
    importType === "swagger"
      ? "Swagger/OpenAPI file"
      : importType === "har"
        ? "HAR file"
        : "Postman Collection file";
  const acceptTypes =
    importType === "swagger"
      ? ".json,.yaml,.yml"
      : importType === "har"
        ? ".har,.json"
        : ".json";
  const modalTitle =
    importType === "swagger"
      ? "Import Swagger/OpenAPI"
      : importType === "har"
        ? "Import HAR File"
        : "Import Postman Collection";

  return (
    <Modal title={modalTitle} onClose={onClose} size="sm">
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div className={styles.toggleGroup}>
          <button
            type="button"
            className={`${styles.toggleButton} ${importType === "postman" ? styles.toggleActive : ""}`}
            onClick={() => setImportType("postman")}
          >
            Postman
          </button>
          <button
            type="button"
            className={`${styles.toggleButton} ${importType === "swagger" ? styles.toggleActive : ""}`}
            onClick={() => setImportType("swagger")}
          >
            Swagger/OpenAPI
          </button>
          <button
            type="button"
            className={`${styles.toggleButton} ${importType === "har" ? styles.toggleActive : ""}`}
            onClick={() => setImportType("har")}
          >
            HAR
          </button>
        </div>

        <Input
          label="Flow Name"
          placeholder="e.g. Authentication"
          value={flowName}
          onChange={(e) => setFlowName(e.target.value)}
        />

        <div className={styles.formGroup}>
          <label className={styles.label}>{typeLabel}</label>
          <input
            type="file"
            accept={acceptTypes}
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
