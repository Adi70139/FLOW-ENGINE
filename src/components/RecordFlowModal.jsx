import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useModules } from "../context/CollectionContext";
import { api } from "../utils/api";
import Modal from "./ui/modal/Modal";
import Button from "./ui/button/Button";
import Input from "./ui/input/Input";
import { IconRecord, IconStop, IconDelete } from "./ui/icons/Icons";
import { toast } from "./ui/toast/toast";
import styles from "./RecordFlowModal.module.css";

export default function RecordFlowModal({ onClose, defaultModuleId }) {
  const navigate = useNavigate();
  const { modules, dispatch } = useModules();

  const [url, setUrl] = useState("");
  const [moduleId, setModuleId] = useState(
    defaultModuleId != null ? String(defaultModuleId) : String(modules[0]?.id || "")
  );
  const [flowName, setFlowName] = useState("");

  // Optional fields
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [port, setPort] = useState("");
  const [include, setInclude] = useState("");
  const [chromePath, setChromePath] = useState("");
  const [attach, setAttach] = useState(false);
  const [redactedHeaders, setRedactedHeaders] = useState("");

  const [session, setSession] = useState(null); // { id, status, url, requestCount, ... }
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const pollRef = useRef(null);

  // Poll the recording status while a session is active
  useEffect(() => {
    if (!session?.id) return;
    let cancelled = false;

    async function poll() {
      try {
        const data = await api.getRecordingStatus(session.id);
        if (!cancelled && data) {
          setSession((prev) => (prev ? { ...prev, ...data } : data));
        }
      } catch {
        // ignore transient errors
      }
    }

    pollRef.current = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [session?.id]);

  async function handleStart() {
    if (!url.trim() || !moduleId || !flowName.trim()) {
      toast.error("URL, Module, and Flow Name are required.");
      return;
    }
    setStarting(true);
    try {
      const body = {
        url: url.trim(),
        moduleId: Number(moduleId),
        flowName: flowName.trim(),
      };
      if (port) body.port = Number(port);
      if (include.trim()) body.include = include.trim();
      if (chromePath.trim()) body.chromePath = chromePath.trim();
      if (attach) body.attach = true;
      if (redactedHeaders.trim()) {
        body.redactedHeaders = redactedHeaders
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }

      const result = await api.startRecording(body);
      setSession(result);
      toast.success("Recording started. Use the launched browser to make API calls.");
    } catch (err) {
      toast.error("Failed to start recording: " + (err.message || err));
    } finally {
      setStarting(false);
    }
  }

  async function handleStopAndImport() {
    if (!session?.id) return;
    setStopping(true);
    try {
      const flow = await api.stopAndImportRecording(session.id);
      toast.success(`Flow "${flow.name}" created with ${flow.steps?.length || 0} steps.`);
      if (pollRef.current) clearInterval(pollRef.current);
      if (flow?.moduleId && flow?.id) {
        dispatch({ type: "ADD_FLOW", moduleId: flow.moduleId, flow });
      }
      onClose();
      if (flow?.moduleId) {
        const slug = (flow.moduleName || "module")
          .toLowerCase()
          .replace(/[^\w ]+/g, "")
          .replace(/ +/g, "-");
        navigate(`/module/${slug}/${flow.moduleId}`);
      }
    } catch (err) {
      toast.error("Failed to stop/import: " + (err.message || err));
    } finally {
      setStopping(false);
    }
  }

  async function handleDiscard() {
    if (!session?.id) {
      onClose();
      return;
    }
    if (!confirm("Discard the current recording? Captured requests will be lost.")) return;
    try {
      await api.discardRecording(session.id);
      toast.success("Recording discarded.");
    } catch (err) {
      toast.error("Failed to discard: " + (err.message || err));
    } finally {
      if (pollRef.current) clearInterval(pollRef.current);
      onClose();
    }
  }

  const isRecording = !!session?.id;

  return (
    <Modal
      title={isRecording ? "Recording Flow" : "Record New Flow"}
      onClose={isRecording ? undefined : onClose}
      size="md"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {!isRecording && (
          <>
            <p className={styles.helpText}>
              Launches Chrome on the target URL and records every XHR/Fetch call as a flow step. Only <strong>URL</strong>, <strong>Module</strong>, and <strong>Flow Name</strong> are required.
            </p>

            <Input
              label="Target URL *"
              placeholder="https://lending-qa.lb.azentio.net"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
            />

            <div className={styles.formGroup}>
              <label className={styles.label}>Target Module *</label>
              <select
                className={styles.select}
                value={moduleId}
                onChange={(e) => setModuleId(e.target.value)}
              >
                <option value="" disabled>Select a module</option>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <Input
              label="Flow Name *"
              placeholder="e.g. Loan Onboarding Flow"
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
            />

            <button
              type="button"
              className={styles.advancedToggle}
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? "▾" : "▸"} Advanced options (optional)
            </button>

            {showAdvanced && (
              <div className={styles.advancedSection}>
                <div className={styles.row}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Chrome Debug Port</label>
                    <input
                      className={styles.input}
                      type="number"
                      placeholder="9222"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>URL Include Filter</label>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="e.g. /api/"
                      value={include}
                      onChange={(e) => setInclude(e.target.value)}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Chrome Path</label>
                  <input
                    className={styles.input}
                    type="text"
                    placeholder="Custom Chrome executable path"
                    value={chromePath}
                    onChange={(e) => setChromePath(e.target.value)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Redacted Headers</label>
                  <input
                    className={styles.input}
                    type="text"
                    placeholder="comma-separated (e.g. Authorization, Cookie)"
                    value={redactedHeaders}
                    onChange={(e) => setRedactedHeaders(e.target.value)}
                  />
                </div>

                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={attach}
                    onChange={(e) => setAttach(e.target.checked)}
                  />
                  Attach to existing Chrome session (instead of launching a new one)
                </label>
              </div>
            )}

            <div className={styles.actions}>
              <Button variant="secondary" onClick={onClose} disabled={starting}>
                Cancel
              </Button>
              <Button
                onClick={handleStart}
                disabled={starting}
                icon={<IconRecord size={14} />}
              >
                {starting ? "Starting..." : "Start Recording"}
              </Button>
            </div>
          </>
        )}

        {isRecording && (
          <>
            <div className={styles.recordingStatus}>
              <div className={styles.recordingHeader}>
                <span className={styles.pulseDot} />
                Recording in progress
              </div>
              <div>
                <div className={styles.countBig}>{session.requestCount ?? 0}</div>
                <div className={styles.countLabel}>API calls captured</div>
              </div>
              <div className={styles.sessionMeta}>
                <div>Session: <code>{session.id}</code></div>
                {session.url && <div>URL: {session.url}</div>}
                {session.status && <div>Status: {session.status}</div>}
              </div>
            </div>

            <p className={styles.helpText}>
              Make API calls in the launched browser. When done, click <strong>Stop & Import</strong> to create the flow.
            </p>

            <div className={styles.actions}>
              <Button
                variant="danger"
                onClick={handleDiscard}
                disabled={stopping}
                icon={<IconDelete size={14} />}
              >
                Discard
              </Button>
              <Button
                onClick={handleStopAndImport}
                disabled={stopping}
                icon={<IconStop size={14} />}
              >
                {stopping ? "Importing..." : "Stop & Import"}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
