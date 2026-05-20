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
import { api } from "../utils/api";
import styles from "./RequestEditor.module.css";
import { useEffect } from "react";

const REQUEST_TABS = [
  { id: "headers", label: "Headers" },
  { id: "body", label: "Body" },
  { id: "assertions", label: "Assertions" },
  { id: "extract", label: "Tests/Extract" },
  { id: "curl", label: "Import cURL", highlight: true },
];

function RequestEditor() {
  const { selectedStep, selectedFlowId, selectedStepId, updateStep, selectedEnv, dispatch } =
    useModules();

  const [activeTab, setActiveTab] = useState("headers");
  const [loading, setLoading] = useState(false);
  const [curlInput, setCurlInput] = useState("");
  const [curlParsed, setCurlParsed] = useState(null);
  const [showParameterize, setShowParameterize] = useState(false);
  const [assertionPrompt, setAssertionPrompt] = useState("");
  const [assertionResponseBody, setAssertionResponseBody] = useState("");
  const [assertionError, setAssertionError] = useState("");
  const [generatingAssertions, setGeneratingAssertions] = useState(false);

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
    }
  }, [selectedStepId, selectedStep?.assertions, selectedStep?.response]);

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
    let schema = null;
    try {
      schema = localSchemaInput.trim() ? JSON.parse(localSchemaInput) : null;
    } catch (err) {
      alert("Invalid JSON Schema structure: " + err.message);
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
    } finally {
      setLoading(false);
    }
  }

  function handleApplyCurl() {
    const parsed = parseCurl(curlInput);
    setCurlParsed(parsed);
    update({
      method: parsed.method || "GET",
      endpoint: parsed.url || "",
      headers: parsed.headers || [],
      payload: parsed.data || "",
    });
    setCurlInput("");
    setCurlParsed(null);
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
    } catch (err) {
      alert("Invalid JSON format. Please verify standard JSON syntax before beautifying.");
    }
  }

  // ── Beautify Response Body ──
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
    } catch (err) {
      alert("Invalid JSON format. Please verify standard JSON syntax before beautifying.");
    }
  }

  async function handleGenerateAssertions() {
    const responseBody = assertionResponseBody.trim() || selectedStep.response?.body || "";
    const description = assertionPrompt.trim();

    if (!responseBody || !description) {
      setAssertionError("Enter both a response body and the assertion description.");
      return;
    }

    setGeneratingAssertions(true);
    setAssertionError("");

    try {
      const assertions = await api.generateAssertions({ responseBody, description });
      update({ assertions });
    } catch (err) {
      setAssertionError(err.message || "Failed to generate assertions.");
    } finally {
      setGeneratingAssertions(false);
    }
  }

  const hasPayload = !!(selectedStep.payload && selectedStep.payload.trim());
  const responseBodyForGenerator = assertionResponseBody || selectedStep.response?.body || "";

  return (
    <div className={styles.editor}>
      <div className={styles.methodRow}>
        <MethodSelect
          value={selectedStep.method || "GET"}
          onChange={(m) => update({ method: m })}
        />
      </div>

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

      <Tabs tabs={REQUEST_TABS} activeTab={activeTab} onChange={setActiveTab} />

      <div className={styles.tabContent}>
        {activeTab === "headers" && (
          <KeyValueTable
            rows={selectedStep.headers || []}
            onChange={(headers) => update({ headers })}
            keyPlaceholder="Header name"
            valuePlaceholder="Header value"
          />
        )}

        {activeTab === "body" && (
          <div className={styles.bodySection}>
            <Textarea
              value={selectedStep.payload || ""}
              onChange={(e) => update({ payload: e.target.value })}
              placeholder={'{\n  "key": "value"\n}'}
              rows={10}
              mono
              label="Request Body (JSON)"
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

        {activeTab === "assertions" && (
          <div className={styles.assertionsSection}>
            <div className={styles.generateAssertions}>
              <div className={styles.generateHeader}>
                <div>
                  <h3>Generate Assertions</h3>
                  <p className={styles.tabDescription}>
                    Describe the checks in English and generate structured assertion JSON from the response body.
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
                      Note: For latest response run the flow once.
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>JSON Schema Assertion</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={localSchemaCritical}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      if (!checked) {
                        const confirmUncheck = window.confirm("Are you sure? Unchecking this means the run will not fail in case of a schema mismatch.");
                        if (!confirmUncheck) return;
                      }
                      setLocalSchemaCritical(checked);
                      setHasChanges(true);
                    }}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  Critical Assertion
                </label>
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

        {activeTab === "extract" && (
          <div className={styles.extractSection}>
            <p className={styles.tabDescription}>
              Extract values from the response JSON to use in subsequent requests as <code>{`{{variableName}}`}</code>.
            </p>
            <KeyValueTable
              rows={selectedStep.extract || []}
              onChange={(extract) => update({ extract })}
              keyPlaceholder="Variable Name (e.g. authToken)"
              valuePlaceholder="JSON Path (e.g. data.token)"
            />
          </div>
        )}

        {activeTab === "curl" && (
          <div className={styles.curlSection}>
            <Textarea
              value={curlInput}
              onChange={(e) => {
                setCurlInput(e.target.value);
                setCurlParsed(null);
              }}
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
