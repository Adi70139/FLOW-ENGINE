import { useState, useEffect, useMemo } from "react";
import { useModules } from "../context/CollectionContext";
import Modal from "./ui/modal/Modal";
import Input from "./ui/input/Input";
import Button from "./ui/button/Button";
import KeyValueTable from "./KeyValueTable";
import { IconPlus, IconDelete, IconModule } from "./ui/icons/Icons";
import IconButton from "./ui/icon-button/IconButton";
import styles from "./EnvironmentModal.module.css";

function EnvironmentModal({ onClose }) {
  const { selectedModule, addEnvironment, updateEnvironment, deleteEnvironment } = useModules();
  const [activeEnvId, setActiveEnvId] = useState(selectedModule?.environments?.[0]?.id || null);
  const [isCreating, setIsCreating] = useState(false);
  const [newEnvName, setNewEnvName] = useState("");
  const [newEnvVariables, setNewEnvVariables] = useState([{ key: "", value: "", enabled: true }]);

  const environments = selectedModule?.environments || [];
  const activeEnv = environments.find(e => e.id === activeEnvId);

  const [envChanges, setEnvChanges] = useState({}); // { [envId]: variables[] }
  const [isSaving, setIsSaving] = useState(false);

  // Memoize variables to prevent KeyValueTable from jittering on every parent render
  const currentEditVariables = useMemo(() => {
    return envChanges[activeEnvId] || (activeEnv ? Object.entries(activeEnv.variables || {}).map(([key, value]) => ({ key, value, enabled: true })) : []);
  }, [activeEnvId, activeEnv, envChanges[activeEnvId]]);

  function handleVariablesChange(newVars) {
    setEnvChanges(prev => ({
      ...prev,
      [activeEnvId]: newVars
    }));
  }

  async function handleAddEnv() {
    if (!newEnvName.trim()) return;
    try {
      const varsObj = newEnvVariables.reduce((acc, r) => {
        if (r.key) acc[r.key] = r.value;
        return acc;
      }, {});
      const newEnv = await addEnvironment(selectedModule.id, {
        name: newEnvName.trim(),
        variables: varsObj
      });
      setIsCreating(false);
      setNewEnvName("");
      setNewEnvVariables([{ key: "", value: "", enabled: true }]);
      setActiveEnvId(newEnv.id);
    } catch (e) {
      alert("Failed to create environment");
    }
  }

  async function handleSaveVariables() {
    if (!activeEnv) return;
    setIsSaving(true);
    try {
      const vars = currentEditVariables.reduce((acc, r) => {
        if (r.key) acc[r.key] = r.value;
        return acc;
      }, {});
      await updateEnvironment(selectedModule.id, activeEnv.id, {
        name: activeEnv.name,
        variables: vars
      });
      // Clear changes for this env after saving
      setEnvChanges(prev => {
        const next = { ...prev };
        delete next[activeEnvId];
        return next;
      });
    } catch (e) {
      console.error("Failed to update variables:", e);
      alert("Failed to save variables");
    } finally {
      setIsSaving(false);
    }
  }


  async function handleDeleteEnv(id) {
    if (!confirm("Are you sure you want to delete this environment?")) return;
    try {
      await deleteEnvironment(selectedModule.id, id);
      if (activeEnvId === id) {
        setActiveEnvId(environments.find(e => e.id !== id)?.id || null);
      }
    } catch (e) {
      alert("Failed to delete environment");
    }
  }

  return (
    <Modal title="Environment Manager" onClose={onClose} size="lg">
      <div className={styles.container}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h3>Environments</h3>
            <IconButton
              size="small"
              variant="ghost"
              onClick={() => setIsCreating(true)}
              title="New Environment"
            >
              <IconPlus size={14} />
            </IconButton>
          </div>
          <div className={styles.envList}>
            {environments.map(env => (
              <div
                key={env.id}
                className={`${styles.envItem} ${activeEnvId === env.id ? styles.active : ""}`}
                onClick={() => {
                  setActiveEnvId(env.id);
                  setIsCreating(false);
                }}
              >
                <IconModule size={14} className={styles.envIcon} />
                <span className={styles.envName}>
                  {env.name}
                  {envChanges[env.id] && <span className={styles.unsavedDot} title="Unsaved changes" />}
                </span>


                <button
                  className={styles.deleteEnvBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteEnv(env.id);
                  }}
                >
                  <IconDelete size={12} />
                </button>
              </div>
            ))}
            {isCreating && (
              <div className={styles.createEnv}>
                <Input
                  value={newEnvName}
                  onChange={(e) => setNewEnvName(e.target.value)}
                  placeholder="e.g. STAGING"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleAddEnv()}
                />
                <div className={styles.createActions}>
                  <KeyValueTable
                    rows={newEnvVariables}
                    onChange={setNewEnvVariables}
                    keyPlaceholder="Key"
                    valuePlaceholder="Value"
                  />
                </div>
                <div className={styles.createActions}>
                  <Button size="small" onClick={handleAddEnv}>Save</Button>
                  <Button size="small" variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        </aside>

        <main className={styles.main}>
          {activeEnv ? (
            <div className={styles.envEditor}>
              <div className={styles.envHeader}>
                <div className={styles.titleRow}>
                  <h2>{activeEnv.name}</h2>
                  <Badge variant="success">Active</Badge>
                </div>
                <p>Configure variables for the <strong>{activeEnv.name}</strong> environment. These will be used to resolve <code>{`{{variables}}`}</code> during execution.</p>
              </div>
              <div className={styles.tableWrapper}>
                <KeyValueTable
                  key={activeEnvId}
                  rows={currentEditVariables}
                  onChange={handleVariablesChange}
                  keyPlaceholder="Variable Name"
                  valuePlaceholder="Value"
                />
                <div className={styles.mainActions}>
                  <Button onClick={handleSaveVariables} disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save Variables"}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🌐</div>
              <h3>Manage Your Environments</h3>
              <p>Create environments like <strong>Production</strong>, <strong>Staging</strong>, or <strong>Local</strong> to manage different API endpoints and secrets seamlessly.</p>
              {!isCreating && <Button onClick={() => setIsCreating(true)} style={{ marginTop: 20 }}>Create First Environment</Button>}
            </div>
          )}
        </main>
      </div>
    </Modal>
  );
}

// Internal Badge for consistency
function Badge({ children, variant = "secondary" }) {
  const badgeStyle = {
    padding: "2px 8px",
    borderRadius: "4px",
    fontSize: "10px",
    fontWeight: "700",
    textTransform: "uppercase",
    background: variant === "success" ? "rgba(16, 185, 129, 0.1)" : "rgba(255, 255, 255, 0.1)",
    color: variant === "success" ? "var(--accent)" : "var(--text-muted)",
    border: `1px solid ${variant === "success" ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.1)"}`,
  };
  return <span style={badgeStyle}>{children}</span>;
}

export default EnvironmentModal;
