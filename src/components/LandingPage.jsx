import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useModules } from "../context/CollectionContext";
import { api } from "../utils/api";
import Button from "./ui/button/Button";
import IconButton from "./ui/icon-button/IconButton";
import Modal from "./ui/modal/Modal";
import Input from "./ui/input/Input";
import Textarea from "./ui/textarea/Textarea";
import { IconModule, IconPlus, IconPlay, IconDelete, IconFlow, IconStep } from "./ui/icons/Icons";
import styles from "./LandingPage.module.css";

const slugify = (text) => text.toLowerCase().replace(/[^\w ]+/g, '').replace(/ +/g, '-');

function LandingPage() {
  const { modules, loading, error } = useModules();
  const [showCreate, setShowCreate] = useState(false);
  const [editingModule, setEditingModule] = useState(null);

  return (
    <div className={styles.landing}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h1>Modules</h1>
          <p>Organize your automation flows into logical modules.</p>
        </div>
        <Button onClick={() => setShowCreate(true)} icon={<IconPlus size={18} />}>
          Create Module
        </Button>
      </div>

      {loading && <div className={styles.loading}>Loading modules...</div>}
      {error && <div className={styles.error}>Error: {error}</div>}

      <div className={styles.grid}>
        {modules.map((mod) => (
          <ModuleCard 
            key={mod.id} 
            module={mod} 
            onEdit={() => setEditingModule(mod)} 
          />
        ))}
        {!loading && modules.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🚀</div>
            <h3>No modules yet</h3>
            <p>Create your first module to start building automation flows.</p>
            <Button onClick={() => setShowCreate(true)} icon={<IconPlus size={18} />}>
              Get Started
            </Button>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateModuleModal onClose={() => setShowCreate(false)} />
      )}
      {editingModule && (
        <UpdateModuleModal 
          module={editingModule} 
          onClose={() => setEditingModule(null)} 
        />
      )}
    </div>
  );
}

function ModuleCard({ module, onEdit }) {
  const { deleteModule } = useModules();
  const navigate = useNavigate();
  const [running, setRunning] = useState(false);

  async function handleRun(e) {
    e.stopPropagation();
    setRunning(true);
    try {
      const results = await api.executeModule(module.id);
      console.log("Module Execution Results:", results);
      alert(`Module "${module.name}" executed. All flows passed: ${results.allFlowsPassed}`);
    } catch (err) {
      alert(`Execution failed: ${err.message}`);
    } finally {
      setRunning(false);
    }
  }

  function handleDelete(e) {
    e.stopPropagation();
    if (confirm(`Delete module "${module.name}" and all its flows?`)) {
      deleteModule(module.id);
    }
  }

  function handleOpen() {
    const slug = slugify(module.name);
    navigate(`/module/${slug}/${module.id}`);
  }

  const flowCount = module.flows?.length || 0;
  const testCount = module.flows?.reduce((acc, f) => acc + (f.tests?.length || 0), 0) || 0;

  return (
    <div className={styles.card} onClick={handleOpen}>
      <div className={styles.cardHeader}>
        <div className={styles.cardIcon}>
          <IconModule size={32} className={styles.accentIcon} />
        </div>
        <div className={styles.cardActions}>
          <IconButton
            variant="secondary"
            size="small"
            title="Edit module"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <IconPlus size={16} style={{ transform: 'rotate(45deg)' }} /> 
          </IconButton>
          <IconButton
            variant="danger"
            size="small"
            className={styles.deleteBtn}
            onClick={handleDelete}
          >
            <IconDelete size={16} />
          </IconButton>
        </div>
      </div>
      <div>
        <h3 className={styles.cardTitle}>{module.name}</h3>
        <p className={styles.cardDesc}>{module.description || "No description provided."}</p>
      </div>
      
      <div className={styles.cardMeta}>
        <div className={styles.metaItem}>
          <IconFlow size={16} className={styles.metaIcon} />
          <span>{flowCount} Flows</span>
        </div>
        <div className={styles.metaItem}>
          <IconStep size={16} className={styles.metaIcon} />
          <span>{testCount} Tests</span>
        </div>
      </div>

      <div className={styles.cardActions}>
        <Button
          variant="primary"
          className={styles.runBtn}
          onClick={handleRun}
          disabled={running}
          icon={running ? <span className={styles.spinner} /> : <IconPlay size={16} />}
        >
          {running ? "Running..." : "Run All"}
        </Button>
      </div>
    </div>
  );
}

function CreateModuleModal({ onClose }) {
  const { addModule } = useModules();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const newMod = await addModule(name, desc);
      const slug = slugify(newMod.name);
      onClose();
      navigate(`/module/${slug}/${newMod.id}`);
    } catch (err) {
      alert("Failed to create module: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Create New Module" onClose={onClose} size="sm">
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <Input
          label="Module Name"
          placeholder="e.g. Authentication, Billing"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <Textarea
          label="Description"
          placeholder="Describe the purpose of this module..."
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={3}
        />
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? "Creating..." : "Create"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function UpdateModuleModal({ module, onClose }) {
  const { updateModule } = useModules();
  const [name, setName] = useState(module.name);
  const [desc, setDesc] = useState(module.description || "");
  const [loading, setLoading] = useState(false);

  async function handleUpdate() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await updateModule(module.id, { name: name.trim(), description: desc.trim() });
      onClose();
    } catch (err) {
      alert("Failed to update module: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Update Module" onClose={onClose} size="sm">
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <Input
          label="Module Name"
          placeholder="e.g. Authentication, Billing"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <Textarea
          label="Description"
          placeholder="Describe the purpose of this module..."
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

export default LandingPage;
