import { useState, useEffect } from "react";
import { useModules } from "../context/CollectionContext";
import Badge from "./ui/badge/Badge";
import IconButton from "./ui/icon-button/IconButton";
import { api } from "../utils/api";
import { IconFlow, IconPlay, IconDelete, IconChevron, IconPlus } from "./ui/icons/Icons";
import Modal from "./ui/modal/Modal";
import Input from "./ui/input/Input";
import Textarea from "./ui/textarea/Textarea";
import Button from "./ui/button/Button";
import styles from "./Sidebar.module.css";

function Sidebar() {
  const { 
    selectedModule, 
    selectedModuleId, 
    selectedFlowId, 
    selectedStepId, 
    dispatch, 
    deleteFlow, 
    updateFlow,
    fetchFlows,
    fetchSteps
  } = useModules();

  useEffect(() => {
    if (selectedFlowId) {
      fetchSteps(selectedFlowId);
    }
  }, [selectedFlowId]);

  useEffect(() => {
    if (selectedModuleId) {
      fetchFlows(selectedModuleId);
    }
  }, [selectedModuleId]);

  const [expanded, setExpanded] = useState(() => {
    const set = new Set();
    if (selectedFlowId) set.add(selectedFlowId);
    return set;
  });

  const [editingFlow, setEditingFlow] = useState(null);

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
    if (selectedFlowId !== flowId) {
      dispatch({ type: "SELECT_FLOW", id: flowId });
    }
    dispatch({ type: "SELECT_STEP", id: stepId });
  }

  function handleDeleteFlow(e, id) {
    e.stopPropagation();
    if (confirm("Delete this flow?")) {
      deleteFlow(selectedModuleId, id);
    }
  }

  const [runningFlowId, setRunningFlowId] = useState(null);

  async function handleRunFlow(e, flow) {
    e.stopPropagation();
    if (runningFlowId) return;
    
    setRunningFlowId(flow.id);
    
    try {
      const results = await api.executeFlow(flow.id);
      
      results.stepResults.forEach(res => {
        dispatch({
          type: "UPDATE_STEP",
          flowId: flow.id,
          stepId: res.stepId,
          patch: { 
            response: {
              status: res.statusCode,
              statusText: res.success ? "OK" : (res.errorMessage || "Error"),
              time: res.durationMs,
              body: res.responseBody,
              headers: [],
              resolvedUrl: res.resolvedUrl,
              resolvedHeaders: res.resolvedHeadersJson ? JSON.parse(res.resolvedHeadersJson) : null,
              resolvedBody: res.resolvedBodyJson,
            }
          }
        });
      });

    } catch (err) {
      alert(`Execution failed: ${err.message}`);
    } finally {
      setRunningFlowId(null);
    }
  }

  if (!selectedModule) return null;

  const flows = selectedModule.flows;

  return (
    <div className={styles.sidebar}>
      {flows === null && <div className={styles.loading}>Loading flows...</div>}
      {(flows || []).map((flow) => {
        const isActive = flow.id === selectedFlowId;
        const isOpen = expanded.has(flow.id);

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
                  <IconPlus size={14} style={{ transform: 'rotate(45deg)' }} />
                </IconButton>
                <IconButton
                  size="small"
                  variant="primary"
                  title="Run Flow"
                  className={styles.runBtn}
                  onClick={(e) => handleRunFlow(e, flow)}
                  disabled={runningFlowId === flow.id}
                >
                  {runningFlowId === flow.id ? (
                    <span className={styles.spinner} />
                  ) : (
                    <IconPlay size={14} />
                  )}
                </IconButton>
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
      
      {editingFlow && (
        <UpdateFlowModal 
          moduleId={selectedModuleId}
          flow={editingFlow} 
          onClose={() => setEditingFlow(null)} 
        />
      )}

      {/* Variables Panel */}
      {selectedFlowId && (
        <div className={styles.variablesPanel}>
          {(() => {
            const currentFlow = selectedModule.flows?.find(f => f.id === selectedFlowId);
            const variables = currentFlow?.variables || {};
            const varEntries = Object.entries(variables);

            return (
              <>
                <div className={styles.variablesHeader}>
                  <span>Memory / Variables</span>
                  <span className={styles.varCount}>{varEntries.length}</span>
                </div>
                <div className={styles.variablesList}>
                  {varEntries.map(([key, val]) => (
                    <div key={key} className={styles.variableItem}>
                      <span className={styles.varKey}>{key}:</span>
                      <span className={styles.varVal} title={String(val)}>
                        {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                      </span>
                    </div>
                  ))}
                  {varEntries.length === 0 && (
                    <div className={styles.varEmpty}>No variables extracted yet.</div>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function UpdateFlowModal({ moduleId, flow, onClose }) {
  const { updateFlow } = useModules();
  const [name, setName] = useState(flow.name);
  const [desc, setDesc] = useState(flow.description || "");
  const [loading, setLoading] = useState(false);

  async function handleUpdate() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await updateFlow(moduleId, flow.id, { name: name.trim(), description: desc.trim() });
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

export default Sidebar;
