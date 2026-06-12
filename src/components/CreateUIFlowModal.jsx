import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useModules } from "../context/CollectionContext";
import { api } from "../utils/api";
import Modal from "./ui/modal/Modal";
import Button from "./ui/button/Button";
import Input from "./ui/input/Input";
import Textarea from "./ui/textarea/Textarea";
import { toast } from "./ui/toast/toast";
import styles from "./RecordFlowModal.module.css";

export default function CreateUIFlowModal({ onClose, defaultModuleId }) {
  const navigate = useNavigate();
  const { modules, dispatch } = useModules();

  const [url, setUrl] = useState("");
  const [moduleId, setModuleId] = useState(
    defaultModuleId != null ? String(defaultModuleId) : String(modules[0]?.id || "")
  );
  const [flowName, setFlowName] = useState("");
  const [steps, setSteps] = useState("");

  // Optional
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [authHeader, setAuthHeader] = useState("");
  const [cookiesJson, setCookiesJson] = useState("");

  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    if (!url.trim() || !moduleId || !flowName.trim() || !steps.trim()) {
      toast.error("URL, Module, Flow Name, and Steps are required.");
      return;
    }

    const module = modules.find((m) => String(m.id) === String(moduleId));
    if (!module?.name) {
      toast.error("Selected module is missing a name.");
      return;
    }

    if (cookiesJson.trim()) {
      try {
        JSON.parse(cookiesJson);
      } catch (e) {
        toast.error("Cookies JSON is not valid JSON: " + e.message);
        return;
      }
    }

    setGenerating(true);
    try {
      const result = await api.generateUiAutomation({
        url: url.trim(),
        steps: steps.trim(),
        moduleName: module.name,
        flowName: flowName.trim(),
        authHeader: authHeader.trim() || undefined,
        cookiesJson: cookiesJson.trim() || undefined,
      });

      // UIAutomationResult is summary-only — fetch the full flow so the sidebar
      // sees steps + flowType + playwrightScript.
      let flow = null;
      if (result?.flowId) {
        try {
          flow = await api.getFlow(result.flowId);
        } catch {
          // ignore — we'll fall back to the summary payload below
        }
      }
      if (!flow && result) {
        flow = {
          id: result.flowId,
          name: result.flowName,
          moduleId: Number(moduleId),
          moduleName: result.moduleName || module.name,
          flowType: "UI",
          playwrightScript: result.playwrightScript,
        };
      }

      if (flow?.id) {
        dispatch({
          type: "ADD_FLOW",
          moduleId: Number(moduleId),
          flow: { ...flow, flowType: flow.flowType || "UI" },
        });
      }

      toast.success(
        `UI flow "${result?.flowName || flowName}" created${
          result?.stepCount ? ` with ${result.stepCount} step${result.stepCount === 1 ? "" : "s"}` : ""
        }.`
      );
      onClose();

      if (flow?.moduleId) {
        const slug = (flow.moduleName || module.name || "module")
          .toLowerCase()
          .replace(/[^\w ]+/g, "")
          .replace(/ +/g, "-");
        navigate(`/module/${slug}/${flow.moduleId}`);
      }
    } catch (err) {
      toast.error("Failed to generate UI flow: " + (err.message || err));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Modal title="Create UI Automation Flow" onClose={generating ? undefined : onClose} size="md">
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <p className={styles.helpText}>
          Generates a Playwright Java flow from natural-language steps. The backend opens the page in a headless
          browser, scrapes interactive elements, and maps your instructions to real locators.
        </p>

        <Input
          label="Target URL *"
          placeholder="https://app.example.com/login"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          autoFocus
          disabled={generating}
        />

        <div className={styles.formGroup}>
          <label className={styles.label}>Target Module *</label>
          <select
            className={styles.select}
            value={moduleId}
            onChange={(e) => setModuleId(e.target.value)}
            disabled={generating}
          >
            <option value="" disabled>Select a module</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        <Input
          label="Flow Name *"
          placeholder="e.g. Login Smoke Test"
          value={flowName}
          onChange={(e) => setFlowName(e.target.value)}
          disabled={generating}
        />

        <Textarea
          label="Steps (natural language) *"
          placeholder={"e.g. enter admin in username, enter secret in password, click Login, verify dashboard loads"}
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
          rows={5}
          disabled={generating}
        />

        <button
          type="button"
          className={styles.advancedToggle}
          onClick={() => setShowAdvanced((v) => !v)}
          disabled={generating}
        >
          {showAdvanced ? "▾" : "▸"} Advanced options (optional)
        </button>

        {showAdvanced && (
          <div className={styles.advancedSection}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Auth Header</label>
              <input
                className={styles.input}
                placeholder="Bearer eyJhbGciOi..."
                value={authHeader}
                onChange={(e) => setAuthHeader(e.target.value)}
                disabled={generating}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Cookies JSON</label>
              <textarea
                className={styles.input}
                placeholder='[{"name":"session","value":"...","domain":".example.com"}]'
                value={cookiesJson}
                onChange={(e) => setCookiesJson(e.target.value)}
                rows={4}
                disabled={generating}
                style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "12px", resize: "vertical" }}
              />
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "4px" }}>
          <Button variant="secondary" onClick={onClose} disabled={generating}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? "Generating…" : "Generate UI Flow"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
