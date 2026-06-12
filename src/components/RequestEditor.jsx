import { useState } from "react";
import { useModules } from "../context/CollectionContext";
import MethodSelect from "./ui/method/MethodSelect";
import Input from "./ui/input/Input";
import Textarea from "./ui/textarea/Textarea";
import Button from "./ui/button/Button";
import Tabs from "./ui/tabs/Tabs";
import Badge from "./ui/badge/Badge";
import KeyValueTable from "./KeyValueTable";
import ParameterizeModal from "./ParameterizeModal";
import EmptyState from "./ui/empty-state/EmptyState";
import { parseCurl } from "../utils/parseCurl";
import { api, sanitizeSkipCondition } from "../utils/api";
import { toast } from "./ui/toast/toast";
import { confirm } from "./ui/confirm/confirm";
import styles from "./RequestEditor.module.css";
import { useEffect } from "react";
import MethodsTab from "./MethodsTab";

const REQUEST_TABS = [
  { id: "headers", label: "Headers" },
  { id: "body", label: "Body" },
  { id: "skip", label: "Skip Condition" },
  { id: "assertions", label: "Assertions" },
  { id: "methods", label: "Custom/Built-in Methods" },
  { id: "curl", label: "Import cURL", highlight: true },
];

function RequestEditor() {
  const { selectedStep, selectedFlow, selectedFlowId, selectedStepId, updateStep, selectedEnv, dispatch } =
    useModules();

  const [activeTab, setActiveTab] = useState("headers");
  const [loading, setLoading] = useState(false);
  const [curlInput, setCurlInput] = useState("");
  const [showParameterize, setShowParameterize] = useState(false);
  const [assertionPrompt, setAssertionPrompt] = useState("");
  const [assertionResponseBody, setAssertionResponseBody] = useState("");
  const [assertionError, setAssertionError] = useState("");
  const [generatingAssertions, setGeneratingAssertions] = useState(false);
  const [schemaValidationError, setSchemaValidationError] = useState("");
  const [generatingSchemaValidation, setGeneratingSchemaValidation] = useState(false);
  const [skipPrompt, setSkipPrompt] = useState("");
  const [skipConditionInput, setSkipConditionInput] = useState("");
  const [skipConditionExplanation, setSkipConditionExplanation] = useState("");
  const [skipConditionError, setSkipConditionError] = useState("");
  const [generatingSkipCondition, setGeneratingSkipCondition] = useState(false);

  const [localStatusCode, setLocalStatusCode] = useState("");
  const [localStatusCodeCritical, setLocalStatusCodeCritical] = useState(false);
  const [localSchemaInput, setLocalSchemaInput] = useState("");
  const [localSchemaCritical, setLocalSchemaCritical] = useState(false);
  const [localBodyRows, setLocalBodyRows] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (selectedStep) {
      setLocalStatusCode(selectedStep.assertions?.statusCode || "");
      setLocalStatusCodeCritical(!!selectedStep.assertions?.statusCodeCritical);
      setLocalSchemaInput(selectedStep.assertions?.schema ? JSON.stringify(selectedStep.assertions.schema, null, 2) : "");
      setLocalSchemaCritical(
        selectedStep.assertions?.schemaCritical !== undefined 
          ? !!selectedStep.assertions.schemaCritical 
          : true
      );

      setLocalBodyRows(Object.entries(selectedStep.assertions?.body || {}).map(([key, obj]) => {
        let value = obj;
        let critical = false;
        if (typeof obj === 'object' && obj !== null && 'critical' in obj) {
          const { critical: c, ...rest } = obj;
          critical = c;
          value = rest;
        }
        return {
          key,
          value: typeof value === 'object' ? JSON.stringify(value) : String(value),
          enabled: true,
          critical
        };
      }));
      setHasChanges(false);

      // Reset assertion generator text areas and states for this step
      setAssertionResponseBody(selectedStep.response?.body || "");
      setAssertionPrompt("");
      setAssertionError("");
      setSchemaValidationError("");
      setSkipPrompt("");
      setSkipConditionInput(selectedStep.skipCondition ? JSON.stringify(selectedStep.skipCondition, null, 2) : "");
      setSkipConditionExplanation("");
      setSkipConditionError("");
    }
  }, [selectedStepId, selectedStep?.assertions, selectedStep?.response, selectedStep?.skipCondition]);

  if (!selectedStep) {
    return (
      <EmptyState
        icon="🔬"
        title="No step selected"
        subtitle="Select a step from the list or create a new one to start building your request."
      />
    );
  }

  function update(patch) {
    updateStep(selectedFlowId, selectedStepId, patch);
  }

  function handleSaveAssertions() {
    let schema;
    try {
      schema = localSchemaInput.trim() ? JSON.parse(localSchemaInput) : null;
    } catch (err) {
      toast.error("Invalid JSON Schema structure: " + err.message);
      return;
    }

    const body = localBodyRows.reduce((acc, row) => {
      if (row.key) {
        try {
          const parsed = JSON.parse(row.value);
          acc[row.key] = typeof parsed === 'object' && parsed !== null
            ? { ...parsed, critical: !!row.critical }
            : { value: parsed, critical: !!row.critical };
        } catch {
          acc[row.key] = { value: row.value, critical: !!row.critical };
        }
      }
      return acc;
    }, {});

    update({
      assertions: {
        statusCode: localStatusCode ? parseInt(localStatusCode) || null : null,
        statusCodeCritical: localStatusCodeCritical,
        schema,
        schemaCritical: localSchemaCritical,
        body
      }
    });
    setHasChanges(false);
    toast.success("Assertions saved");
  }

  function handleSaveSkipCondition() {
    try {
      const skipCondition = skipConditionInput.trim()
        ? sanitizeSkipCondition(JSON.parse(skipConditionInput))
        : null;
      update({ skipCondition });
      setSkipConditionInput(skipCondition ? JSON.stringify(skipCondition, null, 2) : "");
      setSkipConditionError("");
      toast.success("Skip condition saved");
    } catch (err) {
      setSkipConditionError("Invalid skip condition JSON: " + err.message);
      toast.error("Invalid skip condition JSON");
    }
  }

  function handleBeautifyResponseBody() {
    const body = assertionResponseBody || selectedStep.response?.body || "";
    if (!body) return;
    try {
      const parsed = typeof body === "string" ? JSON.parse(body) : body;
      const formatted = JSON.stringify(parsed, null, 2);
      setAssertionResponseBody(formatted);

      const currentResponse = selectedStep.response || {};
      const updatedResponse = { ...currentResponse, body: formatted };
      try {
        localStorage.setItem(`mr_auto_step_response_${selectedStep.id}`, JSON.stringify(updatedResponse));
      } catch (err) {
        console.warn("Failed to save beautified response to localStorage:", err);
      }
      dispatch({
        type: "UPDATE_STEP",
        flowId: selectedFlowId,
        stepId: selectedStep.id,
        patch: { response: updatedResponse }
      });
    } catch {
      toast.error("Invalid JSON format. Please verify standard JSON syntax before beautifying.");
    }
  }

  // Helper to substitute both {{key}} and {key}
  function substitute(str) {
    if (typeof str !== "string") return str;
    const variables = selectedEnv?.variables || {};
    return str.replace(/\{{1,2}(.+?)\}{1,2}/g, (match, key) => {
      const trimmed = key.trim();
      return variables[trimmed] !== undefined ? variables[trimmed] : match;
    });
  }

  // ── Send request ──
  async function sendRequest() {
    if (!selectedStep.endpoint) return;
    setLoading(true);
    const startTime = performance.now();

    const resolvedUrl = substitute(selectedStep.endpoint);
    const resolvedHeaders = (selectedStep.headers || [])
      .filter((h) => h.enabled !== false && h.key)
      .reduce((acc, h) => {
        acc[h.key] = substitute(h.value);
        return acc;
      }, {});

    let resolvedBody = undefined;
    const methodUpper = (selectedStep.method || "GET").toUpperCase();
    if (["POST", "PUT", "PATCH", "DELETE"].includes(methodUpper)) {
      resolvedBody = substitute(selectedStep.payload);
    }

    try {
      const opts = {
        method: selectedStep.method || "GET",
        headers: resolvedHeaders,
      };

      if (resolvedBody !== undefined) {
        opts.body = resolvedBody;
      }

      const res = await fetch(resolvedUrl, opts);
      const text = await res.text();
      const elapsed = Math.round(performance.now() - startTime);

      const resHeaders = [];
      res.headers.forEach((value, key) => {
        resHeaders.push({ key, value });
      });

      update({
        response: {
          status: res.status,
          statusText: res.statusText,
          time: elapsed,
          size: new Blob([text]).size,
          body: text,
          headers: resHeaders,
          resolvedUrl: resolvedUrl,
          resolvedHeaders: resolvedHeaders,
          resolvedBody: resolvedBody
        },
      });
      toast.success("Request completed");
    } catch (e) {
      const elapsed = Math.round(performance.now() - startTime);
      update({
        response: {
          status: 0,
          statusText: "Network Error",
          time: elapsed,
          size: 0,
          body: `Error: ${String(e.message || e)}`,
          headers: [],
          resolvedUrl: resolvedUrl,
          resolvedHeaders: resolvedHeaders,
          resolvedBody: resolvedBody
        },
      });
      toast.error("Request failed");
    } finally {
      setLoading(false);
    }
  }

  function handleApplyCurl() {
    const parsed = parseCurl(curlInput);
    update({
      method: parsed.method || "GET",
      endpoint: parsed.url || "",
      headers: parsed.headers || [],
      payload: parsed.data || "",
    });
    setCurlInput("");
    setActiveTab("headers");
  }

  // ── Parameterize ──
  function handleParameterizeApply(rows, updatedPayload) {
    update({
      parameterizedFields: rows,
      payload: updatedPayload
    });
  }

  // ── Beautify JSON ──
  function handleBeautify() {
    const payload = selectedStep.payload;
    if (!payload) return;
    try {
      const parsed = typeof payload === "string" ? JSON.parse(payload) : payload;
      const formatted = JSON.stringify(parsed, null, 2);
      update({ payload: formatted });
    } catch {
      toast.error("Invalid JSON format. Please verify standard JSON syntax before beautifying.");
    }
  }

  async function handleGenerateAssertions() {
    const description = assertionPrompt.trim();

    if (!description) {
      setAssertionError("Enter the assertion description.");
      return;
    }

    setGeneratingAssertions(true);
    setAssertionError("");

    try {
      const assertions = await api.generateAssertions({ stepId: selectedStep.id, description });
      update({ assertions });
      toast.success("Assertions generated");
    } catch (err) {
      setAssertionError(err.message || "Failed to generate assertions.");
      toast.error(err.message || "Failed to generate assertions");
    } finally {
      setGeneratingAssertions(false);
    }
  }

  function extractSchemaFromAssertionsPayload(payload) {
    if (!payload || typeof payload !== "object") return null;

    if (payload.schema && typeof payload.schema === "object") {
      return payload.schema;
    }

    if (payload.assertions?.schema && typeof payload.assertions.schema === "object") {
      return payload.assertions.schema;
    }

    if (payload.data?.schema && typeof payload.data.schema === "object") {
      return payload.data.schema;
    }

    if (payload.assertionsJson && typeof payload.assertionsJson === "string") {
      try {
        const parsed = JSON.parse(payload.assertionsJson);
        return parsed?.schema && typeof parsed.schema === "object" ? parsed.schema : null;
      } catch {
        return null;
      }
    }

    return null;
  }

  function extractSchemaCriticalFromAssertionsPayload(payload) {
    if (!payload || typeof payload !== "object") return undefined;

    if (typeof payload.schemaCritical === "boolean") return payload.schemaCritical;
    if (typeof payload.assertions?.schemaCritical === "boolean") return payload.assertions.schemaCritical;
    if (typeof payload.data?.schemaCritical === "boolean") return payload.data.schemaCritical;

    if (payload.assertionsJson && typeof payload.assertionsJson === "string") {
      try {
        const parsed = JSON.parse(payload.assertionsJson);
        if (typeof parsed?.schemaCritical === "boolean") return parsed.schemaCritical;
      } catch {
        return undefined;
      }
    }

    return undefined;
  }

  async function handleGenerateSchemaValidation() {
    if (!selectedStep?.id) return;

    setGeneratingSchemaValidation(true);
    setSchemaValidationError("");

    try {
      await api.generateSchemaValidation(selectedStep.id);
      const currentAssertions = await api.getStepAssertions(selectedStep.id);
      const schema = extractSchemaFromAssertionsPayload(currentAssertions);

      if (!schema) {
        throw new Error("Schema was generated but not returned by assertions endpoint.");
      }

      setLocalSchemaInput(JSON.stringify(schema, null, 2));
      const schemaCritical = extractSchemaCriticalFromAssertionsPayload(currentAssertions);
      if (typeof schemaCritical === "boolean") {
        setLocalSchemaCritical(schemaCritical);
      }
      setHasChanges(true);
      toast.success("Schema validation generated");
    } catch (err) {
      const errorMessage = err.message || "Failed to generate schema validation.";
      setSchemaValidationError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setGeneratingSchemaValidation(false);
    }
  }

  async function handleGenerateSkipCondition() {
    const description = skipPrompt.trim();

    if (!description) {
      setSkipConditionError("Enter the skip condition description.");
      return;
    }

    setGeneratingSkipCondition(true);
    setSkipConditionError("");

    try {
      const generated = await api.generateSkipCondition({
        flowId: selectedFlowId,
        targetStepOrder: parseInt(selectedStep.stepOrder, 10) || 1,
        description
      });
      const skipCondition = sanitizeSkipCondition(generated);

      setSkipConditionInput(JSON.stringify(skipCondition, null, 2));
      setSkipConditionExplanation(generated?.explanation || "");
      toast.success("Skip condition generated");
    } catch (err) {
      setSkipConditionError(err.message || "Failed to generate skip condition.");
      toast.error(err.message || "Failed to generate skip condition");
    } finally {
      setGeneratingSkipCondition(false);
    }
  }

  const hasPayload = !!(selectedStep.payload && selectedStep.payload.trim());
  const savedSkipConditionInput = selectedStep.skipCondition ? JSON.stringify(selectedStep.skipCondition, null, 2) : "";
  const hasSkipConditionChanges = skipConditionInput.trim() !== savedSkipConditionInput.trim();
  const canSaveSkipCondition = skipConditionInput.trim().length > 0 && hasSkipConditionChanges;
  const responseBodyForGenerator = assertionResponseBody || selectedStep.response?.body || "";
  const isUiFlow = selectedFlow?.flowType === "UI";
  const visibleTabs = isUiFlow
    ? REQUEST_TABS.filter((t) => t.id === "body")
    : REQUEST_TABS;
  const effectiveActiveTab = visibleTabs.some((t) => t.id === activeTab)
    ? activeTab
    : visibleTabs[0]?.id || "headers";
  return (
    <div className={styles.editor}>
      {!isUiFlow && (
        <div className={styles.methodRow}>
          <MethodSelect
            value={selectedStep.method || "GET"}
            onChange={(m) => update({ method: m })}
          />
        </div>
      )}

      <div className={styles.urlBar}>
        <div className={styles.urlInput}>
          <Input
            value={selectedStep.endpoint || ""}
            onChange={(e) => update({ endpoint: e.target.value })}
            placeholder="Enter request URL  ·  e.g. https://api.example.com/users"
            mono
          />
        </div>
        <Button
          onClick={sendRequest}
          disabled={loading || !selectedStep.endpoint}
          className={styles.sendBtn}
          icon={loading ? <span className={styles.spinner} /> : "▶"}
        >
          {loading ? "Sending…" : "Send"}
        </Button>
      </div>

      {selectedStep.requiredParams && selectedStep.requiredParams.length > 0 && (
        <div className={styles.paramInfo}>
          <span className={styles.paramLabel}>Required Params:</span>
          {selectedStep.requiredParams.map(p => (
            <Badge key={p} variant="secondary" size="small">{p}</Badge>
          ))}
          <p className={styles.paramHint}>These will be auto-resolved from previous step responses.</p>
        </div>
      )}

      <Tabs tabs={visibleTabs} activeTab={effectiveActiveTab} onChange={setActiveTab} />

      <div className={styles.tabContent}>
        {effectiveActiveTab === "headers" && (
          <KeyValueTable
            rows={selectedStep.headers || []}
            onChange={(headers) => update({ headers })}
            keyPlaceholder="Header name"
            valuePlaceholder="Header value"
          />
        )}

        {effectiveActiveTab === "body" && (
          <div className={styles.bodySection}>
            {!isUiFlow && (() => {
              const allSteps = selectedFlow?.tests || [];
              const currentOrder =
                typeof selectedStep.stepOrder === "number"
                  ? selectedStep.stepOrder
                  : Number.MAX_SAFE_INTEGER;
              const previousSteps = allSteps
                .filter(
                  (s) =>
                    s.id !== selectedStep.id &&
                    typeof s.stepOrder === "number" &&
                    s.stepOrder < currentOrder
                )
                .sort((a, b) => a.stepOrder - b.stepOrder);

              const inherit = !!selectedStep.inheritBodyFromPreviousStep;
              const sourceId = selectedStep.bodySourceStepId ?? "";
              const sourceExists =
                sourceId !== "" &&
                previousSteps.some((s) => String(s.id) === String(sourceId));

              return (
                <div className={styles.inheritBody}>
                  <label className={styles.inheritToggle}>
                    <input
                      type="checkbox"
                      checked={inherit}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        const patch = { inheritBodyFromPreviousStep: checked };
                        if (!checked) {
                          patch.bodySourceStepId = null;
                        } else if (!sourceId && previousSteps.length > 0) {
                          patch.bodySourceStepId = previousSteps[previousSteps.length - 1].id;
                        }
                        update(patch);
                      }}
                      disabled={previousSteps.length === 0}
                    />
                    <span>Inherit body from a previous step's response</span>
                  </label>

                  {inherit && (
                    <>
                      <div className={styles.inheritRow}>
                        <label className={styles.inheritLabel}>
                          Source step
                        </label>
                        <select
                          className={styles.inheritSelect}
                          value={sourceId}
                          onChange={(e) =>
                            update({
                              bodySourceStepId: e.target.value
                                ? parseInt(e.target.value, 10)
                                : null,
                            })
                          }
                          disabled={previousSteps.length === 0}
                        >
                          <option value="">— Select a previous step —</option>
                          {previousSteps.map((s) => (
                            <option key={s.id} value={s.id}>
                              Step {s.stepOrder}: {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <p className={styles.inheritHint}>
                        The selected step's response body will be used as the
                        base body for this request. Fields you define below are
                        merged on top — add new fields or override existing ones.
                      </p>
                      {sourceId && !sourceExists && (
                        <div className={styles.inheritWarn}>
                          The previously selected source step is no longer
                          available. Pick another step.
                        </div>
                      )}
                    </>
                  )}

                  {previousSteps.length === 0 && (
                    <p className={styles.inheritHint}>
                      No earlier steps exist in this flow. Add a step before
                      this one to enable body inheritance.
                    </p>
                  )}
                </div>
              );
            })()}

            <Textarea
              value={selectedStep.payload || ""}
              onChange={(e) => update({ payload: e.target.value })}
              placeholder={
                selectedStep.inheritBodyFromPreviousStep
                  ? '{\n  "// Add/override fields on inherited body": ""\n}'
                  : '{\n  "key": "value"\n}'
              }
              rows={10}
              mono
              highlightParameterizedTokens
              label={
                selectedStep.inheritBodyFromPreviousStep
                  ? "Body Overrides (JSON) — merged onto inherited body"
                  : "Request Body (JSON)"
              }
            />
            <div className={styles.bodyActions}>
              <Button
                variant="secondary"
                size="small"
                icon="✨"
                onClick={handleBeautify}
                disabled={!hasPayload}
                style={{ marginRight: "8px" }}
              >
                Beautify JSON
              </Button>
              <Button
                variant="secondary"
                size="small"
                icon="⚙"
                onClick={() => setShowParameterize(true)}
                disabled={!hasPayload}
              >
                Parameterize
              </Button>
              {selectedStep.parameterizedFields?.filter(r => r.parameterize).length > 0 && (
                <span className={styles.paramBadge}>
                  {selectedStep.parameterizedFields.filter(r => r.parameterize).length} field
                  {selectedStep.parameterizedFields.filter(r => r.parameterize).length > 1 ? "s" : ""} parameterized
                </span>
              )}
            </div>
          </div>
        )}

        {effectiveActiveTab === "skip" && (
          <div className={styles.assertionsSection}>
            <div className={styles.generateAssertions}>
              <div className={styles.generateHeader}>
                <div>
                  <h3>Generate Skip Condition</h3>
                  <p className={styles.tabDescription}>
                    Describe when this step should be skipped. Review and tweak the generated JSON before saving.
                  </p>
                </div>
                <Button
                  size="small"
                  onClick={handleGenerateSkipCondition}
                  disabled={generatingSkipCondition}
                >
                  {generatingSkipCondition ? "Generating..." : "Generate"}
                </Button>
              </div>

              <Textarea
                label="English Description"
                placeholder="e.g. Skip this step when the previous response status is not active."
                rows={3}
                value={skipPrompt}
                onChange={(e) => setSkipPrompt(e.target.value)}
              />

              {skipConditionError && (
                <div className={styles.assertionError}>{skipConditionError}</div>
              )}
            </div>

            {skipConditionExplanation && (
              <div className={styles.generatedExplanation}>
                <span className={styles.generatedExplanationLabel}>Explanation</span>
                <p>{skipConditionExplanation}</p>
              </div>
            )}

            <div className={styles.assertionRow}>
              <label>Skip Condition JSON</label>
              <Textarea
                placeholder={'{\n  "logic": "AND",\n  "conditions": []\n}'}
                rows={8}
                mono
                value={skipConditionInput}
                onChange={(e) => setSkipConditionInput(e.target.value)}
              />
            </div>

            <div className={styles.actionRow}>
              <Button variant="secondary" onClick={() => setSkipConditionInput("")}>
                Clear
              </Button>
              <Button onClick={handleSaveSkipCondition} disabled={!canSaveSkipCondition}>
                Save Skip Condition
              </Button>
            </div>
          </div>
        )}

        {effectiveActiveTab === "assertions" && (
          <div className={styles.assertionsSection}>
            <div className={styles.generateAssertions}>
              <div className={styles.generateHeader}>
                <div>
                  <h3>Generate Assertions</h3>
                  <p className={styles.tabDescription}>
                    Describe the checks in English and generate structured assertion JSON for this step.
                  </p>
                  <p className={styles.aiNote}>
                    AI-generated assertions can be wrong. Please review and verify them before saving or running the flow.
                  </p>
                </div>
                <Button
                  size="small"
                  onClick={handleGenerateAssertions}
                  disabled={generatingAssertions}
                >
                  {generatingAssertions ? "Generating..." : "Generate"}
                </Button>
              </div>

              <Textarea
                label="English Description"
                placeholder="e.g. Status code should be 200, id should exist, and status should be active."
                rows={3}
                value={assertionPrompt}
                onChange={(e) => setAssertionPrompt(e.target.value)}
              />

              <Textarea
                label={
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span>Response Body</span>
                      {responseBodyForGenerator && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            handleBeautifyResponseBody();
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--accent)",
                            fontSize: "11px",
                            fontWeight: "700",
                            cursor: "pointer",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            display: "flex",
                            alignItems: "center",
                            gap: "3px",
                            transition: "background 0.2s"
                          }}
                          onMouseOver={(e) => e.target.style.background = "rgba(16, 185, 129, 0.08)"}
                          onMouseOut={(e) => e.target.style.background = "none"}
                        >
                          ✨ Beautify
                        </button>
                      )}
                    </div>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontWeight: "normal", fontStyle: "italic" }}>
                      Note: The generator sends step id and description only.
                    </span>
                  </div>
                }
                placeholder="Run the request first if dependency on other requests, or paste a sample response JSON here."
                rows={6}
                mono
                value={responseBodyForGenerator}
                onChange={(e) => {
                  const val = e.target.value;
                  setAssertionResponseBody(val);
                  const currentResponse = selectedStep.response || {};
                  const updatedResponse = { ...currentResponse, body: val };
                  try {
                    localStorage.setItem(`mr_auto_step_response_${selectedStep.id}`, JSON.stringify(updatedResponse));
                  } catch (err) {
                    console.warn("Failed to save edited response to localStorage:", err);
                  }
                  dispatch({
                    type: "UPDATE_STEP",
                    flowId: selectedFlowId,
                    stepId: selectedStep.id,
                    patch: { response: updatedResponse }
                  });
                }}
              />

              {assertionError && (
                <div className={styles.assertionError}>{assertionError}</div>
              )}
            </div>

            <div className={styles.assertionRow}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Expected Status Code</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={localStatusCodeCritical}
                    onChange={(e) => {
                      setLocalStatusCodeCritical(e.target.checked);
                      setHasChanges(true);
                    }}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  Critical Assertion
                </label>
              </div>
              <Input
                type="number"
                placeholder="e.g. 200"
                value={localStatusCode}
                onChange={(e) => {
                  setLocalStatusCode(e.target.value);
                  setHasChanges(true);
                }}
              />
            </div>
            <div className={styles.assertionRow}>
              <div className={styles.schemaHeader}>
                <label>JSON Schema Assertion</label>
                <div className={styles.schemaHeaderControls}>
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={handleGenerateSchemaValidation}
                    disabled={generatingSchemaValidation}
                  >
                    {generatingSchemaValidation ? "Generating..." : "Generate Schema Validation"}
                  </Button>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={localSchemaCritical}
                      onChange={async (e) => {
                        const checked = e.target.checked;
                        if (!checked) {
                          const ok = await confirm({
                            title: "Disable critical schema assertion?",
                            message: "The run will NOT fail in case of a schema mismatch.",
                            confirmLabel: "Disable",
                            variant: "danger",
                          });
                          if (!ok) return;
                        }
                        setLocalSchemaCritical(checked);
                        setHasChanges(true);
                      }}
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    Critical Assertion
                  </label>
                </div>
              </div>
              <Textarea
                placeholder="Enter JSON Schema to validate response body"
                rows={5}
                mono
                value={localSchemaInput}
                onChange={(e) => {
                  setLocalSchemaInput(e.target.value);
                  setHasChanges(true);
                }}
              />
              {schemaValidationError && (
                <div className={styles.assertionError}>{schemaValidationError}</div>
              )}
            </div>
            <div className={styles.assertionRow}>
              <label>Field Assertions</label>
              <p className={styles.tabDescription}>Assert specific values in the response body JSON.</p>
              <p className={styles.tabDescription}>Note: Critical Assertion failure will result in stopping the test run.</p>

              <KeyValueTable
                key={`${selectedStepId}-assertions`}
                rows={localBodyRows}
                onChange={(rows) => {
                  setLocalBodyRows(rows);
                  setHasChanges(true);
                }}
                keyPlaceholder="JSON Path (e.g. status)"
                valuePlaceholder="Expected Value (e.g. 'success')"
                showCritical={true}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "24px" }}>
              <Button onClick={handleSaveAssertions} disabled={!hasChanges}>
                Save Assertions
              </Button>
            </div>
          </div>
        )}

        {effectiveActiveTab === "methods" && (
          <MethodsTab flowId={selectedFlowId} stepId={selectedStepId} />
        )}

        {effectiveActiveTab === "curl" && (
          <div className={styles.curlSection}>
            <Textarea
              value={curlInput}
              onChange={(e) => setCurlInput(e.target.value)}
              placeholder={`Paste your cURL command here...`}
              rows={6}
              mono
              label="cURL Command"
            />
            <div className={styles.curlActions}>
              <Button
                size="small"
                onClick={handleApplyCurl}
              >
                Apply to Request
              </Button>
            </div>
          </div>
        )}
      </div>

      {showParameterize && (
        <ParameterizeModal
          payload={selectedStep.payload}
          existingFields={selectedStep.parameterizedFields || []}
          onClose={() => setShowParameterize(false)}
          onApply={handleParameterizeApply}
        />
      )}
    </div>
  );
}

export default RequestEditor;
