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
  const [initialDelayMs, setInitialDelayMs] = useState(0);
  const [pollUntilSuccess, setPollUntilSuccess] = useState(false);
  const [pollIntervalMs, setPollIntervalMs] = useState(1000);
  const [pollMaxAttempts, setPollMaxAttempts] = useState(5);
  const [pollExpectedStatus, setPollExpectedStatus] = useState(200);
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
      await addStep(selectedFlowId, {
        name: name.trim(),
        description: desc.trim(),
        retryCount,
        retryDelayMs,
        initialDelayMs,
        pollUntilSuccess,
        pollIntervalMs,
        pollMaxAttempts,
        pollExpectedStatus,
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
    <Modal title="New Step" onClose={onClose} size="lg">
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
              label="Retry Delay (ms)"
              placeholder="e.g. 1000"
              value={retryDelayMs}
              onChange={(e) => {
                setRetryDelayMs(parseInt(e.target.value) || 0);
                setError("");
              }}
              disabled={loading}
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
              disabled={loading}
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px" }}>
          <input
            type="checkbox"
            id="createModalPollUntilSuccess"
            checked={pollUntilSuccess}
            onChange={(e) => setPollUntilSuccess(e.target.checked)}
            style={{ width: "16px", height: "16px", cursor: "pointer" }}
            disabled={loading}
          />
          <label htmlFor="createModalPollUntilSuccess" style={{ fontWeight: "600", fontSize: "14px", color: "var(--text-primary)", cursor: "pointer" }}>
            Poll Until Success (Repeat request until expected status is met)
          </label>
        </div>

        {pollUntilSuccess && (
          <div style={{ display: "flex", gap: "16px" }}>
            <div style={{ flex: 1 }}>
              <Input
                type="number"
                min="1"
                label="Poll Interval (ms)"
                placeholder="e.g. 1000"
                value={pollIntervalMs}
                onChange={(e) => {
                  setPollIntervalMs(parseInt(e.target.value) || 0);
                  setError("");
                }}
                disabled={loading}
              />
            </div>
            <div style={{ flex: 1 }}>
              <Input
                type="number"
                min="1"
                label="Max Poll Attempts"
                placeholder="e.g. 5"
                value={pollMaxAttempts}
                onChange={(e) => {
                  setPollMaxAttempts(parseInt(e.target.value) || 0);
                  setError("");
                }}
                disabled={loading}
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
                onChange={(e) => {
                  setPollExpectedStatus(parseInt(e.target.value) || 0);
                  setError("");
                }}
                disabled={loading}
              />
            </div>
          </div>
        )}

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
