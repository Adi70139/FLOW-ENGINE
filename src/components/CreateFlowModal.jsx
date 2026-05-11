import { useState } from "react";
import { useModules } from "../context/CollectionContext";
import Modal from "./ui/modal/Modal";
import Input from "./ui/input/Input";
import Textarea from "./ui/textarea/Textarea";
import Button from "./ui/button/Button";

function CreateFlowModal({ onClose }) {
  const { selectedModuleId, addFlow } = useModules();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handle() {
    if (!name.trim()) {
      setError("Flow name is required");
      return;
    }
    setLoading(true);
    try {
      await addFlow(selectedModuleId, name.trim(), desc.trim());
      onClose();
    } catch (err) {
      setError(err.message || "Failed to create flow");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && name.trim() && !loading) {
      handle();
    }
  }

  return (
    <Modal title="New Flow" onClose={onClose} size="sm">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
        <Input
          label="Flow Name"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
          placeholder="e.g. User Signup Flow, Password Reset"
          onKeyDown={handleKeyDown}
          autoFocus
          disabled={loading}
        />
        {error && (
          <span style={{ color: "var(--status-error)", fontSize: "var(--text-sm)" }}>
            {error}
          </span>
        )}
        <Textarea
          label="Description (optional)"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="What scenarios does this flow cover?"
          rows={3}
          disabled={loading}
        />
        <div style={{ display: "flex", gap: "var(--space-sm)", justifyContent: "flex-end", marginTop: "var(--space-sm)" }}>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handle} disabled={loading}>
            {loading ? "Creating..." : "Create Flow"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default CreateFlowModal;
