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
  const { selectedStep, selectedFlowId, selectedStepId, updateStep } =
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
  const [schemaInput, setSchemaInput] = useState("");

  useEffect(() => {
    setSchemaInput(selectedStep?.assertions?.schema ? JSON.stringify(selectedStep.assertions.schema, null, 2) : "");
  }, [selectedStepId, selectedStep?.assertions?.schema]);

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

  // ── Send request ──
  async function sendRequest() {
    if (!selectedStep.endpoint) return;
    setLoading(true);
    const startTime = performance.now();

    try {
      const enabledHeaders = (selectedStep.headers || [])
        .filter((h) => h.enabled !== false && h.key)
        .reduce((acc, h) => {
          acc[h.key] = h.value;
          return acc;
        }, {});

      const opts = {
        method: selectedStep.method || "GET",
        headers: enabledHeaders,
      };

      if (["POST", "PUT", "PATCH", "DELETE"].includes((selectedStep.method || "").toUpperCase())) {
        opts.body = selectedStep.payload || undefined;
      }

      const res = await fetch(selectedStep.endpoint, opts);
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
                label="Response Body"
                placeholder="Run the request first, or paste a sample response JSON here."
                rows={6}
                mono
                value={responseBodyForGenerator}
                onChange={(e) => setAssertionResponseBody(e.target.value)}
              />

              {assertionError && (
                <div className={styles.assertionError}>{assertionError}</div>
              )}
            </div>

            <div className={styles.assertionRow}>
              <label>Expected Status Code</label>
              <Input
                type="number"
                placeholder="e.g. 200"
                value={selectedStep.assertions?.statusCode || ""}
                onChange={(e) => update({ assertions: { ...selectedStep.assertions, statusCode: parseInt(e.target.value) || null } })}
              />
            </div>
            <div className={styles.assertionRow}>
              <label>JSON Schema Assertion</label>
              <Textarea
                placeholder="Enter JSON Schema to validate response body"
                rows={5}
                mono
                value={schemaInput}
                onChange={(e) => setSchemaInput(e.target.value)}
                onBlur={() => {
                  try {
                    const schema = schemaInput.trim() ? JSON.parse(schemaInput) : null;
                    update({ assertions: { ...selectedStep.assertions, schema } });
                  } catch (err) {
                    // Do nothing on invalid JSON typing
                  }
                }}
              />
            </div>
            <div className={styles.assertionRow}>
              <label>Field Assertions</label>
              <p className={styles.tabDescription}>Assert specific values in the response body JSON.</p>
              <KeyValueTable
                rows={Object.entries(selectedStep.assertions?.body || {}).map(([key, value]) => ({ key, value: JSON.stringify(value), enabled: true }))}
                onChange={(rows) => {
                  const body = rows.reduce((acc, row) => {
                    if (row.key) {
                      try { acc[row.key] = JSON.parse(row.value); }
                      catch { acc[row.key] = row.value; }
                    }
                    return acc;
                  }, {});
                  update({ assertions: { ...selectedStep.assertions, body } });
                }}
                keyPlaceholder="JSON Path (e.g. status)"
                valuePlaceholder="Expected Value (e.g. 'success')"
              />
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
