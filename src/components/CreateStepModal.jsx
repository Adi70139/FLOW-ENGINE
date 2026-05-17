import { useState } from "react";
import { useModules } from "../context/CollectionContext";
import Modal from "./ui/modal/Modal";
import Input from "./ui/input/Input";
import Textarea from "./ui/textarea/Textarea";
import Button from "./ui/button/Button";

function CreateStepModal({ onClose }) {
  const { selectedFlowId, addStep } = useModules();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [retryDelayMs, setRetryDelayMs] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handle() {
    if (!name.trim()) {
      setError("Step name is required");
      return;
    }
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
      await addStep(selectedFlowId, {
        name: name.trim(),
        description: desc.trim(),
        retryCount,
        retryDelayMs
      });
      onClose();
    } catch (err) {
      setError(err.message || "Failed to create step");
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
    <Modal title="New Step" onClose={onClose} size="sm">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
        <Input
          label="Step Name"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
          placeholder="e.g. Create User, Get Profile"
          onKeyDown={handleKeyDown}
          autoFocus
          disabled={loading}
        />
        <Textarea
          label="Description (optional)"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="What does this step verify?"
          rows={3}
          disabled={loading}
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
              disabled={loading}
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
              disabled={loading}
            />
          </div>
        </div>
        {error && (
          <span style={{ color: "var(--status-error)", fontSize: "var(--text-sm)" }}>
            {error}
          </span>
        )}
        <div style={{ display: "flex", gap: "var(--space-sm)", justifyContent: "flex-end", marginTop: "var(--space-sm)" }}>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handle} disabled={loading}>
            {loading ? "Creating..." : "Create Step"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default CreateStepModal;
