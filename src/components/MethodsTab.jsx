import { useState, useEffect } from "react";
import { api } from "../utils/api";
import { toast } from "./ui/toast/toast";
import Button from "./ui/button/Button";
import Input from "./ui/input/Input";
import Textarea from "./ui/textarea/Textarea";
import IconButton from "./ui/icon-button/IconButton";
import { IconDelete, IconEdit } from "./ui/icons/Icons";
import styles from "./MethodsTab.module.css";

function MethodsTab({ flowId, stepId }) {
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  
  // Form state for generating custom method
  const [methodName, setMethodName] = useState("");
  const [methodDescription, setMethodDescription] = useState("");
  const [parameters, setParameters] = useState([{ name: "", type: "", description: "", required: false }]);
  const [generatingMethod, setGeneratingMethod] = useState(false);
  
  // Form state for testing method
  const [testMethodId, setTestMethodId] = useState("");
  const [testParameters, setTestParameters] = useState({});
  const [testingMethod, setTestingMethod] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Form state for editing existing method
  const [editingMethodId, setEditingMethodId] = useState(null);
  const [editMethodName, setEditMethodName] = useState("");
  const [editMethodDescription, setEditMethodDescription] = useState("");
  const [editMethodScript, setEditMethodScript] = useState("");
  const [editParameters, setEditParameters] = useState([
    { name: "", type: "", description: "", required: false },
  ]);
  const [updatingMethod, setUpdatingMethod] = useState(false);
  const [savingMethodId, setSavingMethodId] = useState(null);
  const [discardingMethodId, setDiscardingMethodId] = useState(null);

  // Form state for attaching method to step
  const [attachingMethodId, setAttachingMethodId] = useState(null);
  const [attachParameterBindings, setAttachParameterBindings] = useState({});
  const [attachingToStep, setAttachingToStep] = useState(false);

  useEffect(() => {
    fetchMethods();
  }, []);

  async function fetchMethods() {
    setLoading(true);
    try {
      const data = await api.getAllMethodsIncludingDrafts();
      setMethods(Array.isArray(data) ? data : []);
    } catch (err) {
      try {
        const fallbackData = await api.getAllMethods();
        setMethods(Array.isArray(fallbackData) ? fallbackData : []);
      } catch (fallbackErr) {
        toast.error("Failed to fetch methods: " + fallbackErr.message);
      }
    } finally {
      setLoading(false);
    }
  }

  function isUserDefinedMethod(method) {
    return method?.type === "USER_DEFINED";
  }

  function startEditMethod(method) {
    setEditingMethodId(method.id);
    setEditMethodName(method.name || "");
    setEditMethodDescription(method.description || "");
    setEditMethodScript(method.groovyScript || "");

    if (Array.isArray(method.parameters) && method.parameters.length > 0) {
      setEditParameters(
        method.parameters.map((param) => ({
          name: param.name || "",
          type: param.type || "",
          description: param.description || "",
          required: !!param.required,
        }))
      );
      return;
    }

    setEditParameters([{ name: "", type: "", description: "", required: false }]);
  }

  function cancelEditMethod() {
    setEditingMethodId(null);
    setEditMethodName("");
    setEditMethodDescription("");
    setEditMethodScript("");
    setEditParameters([{ name: "", type: "", description: "", required: false }]);
  }

  function handleAddEditParameter() {
    setEditParameters([
      ...editParameters,
      { name: "", type: "", description: "", required: false },
    ]);
  }

  function handleRemoveEditParameter(index) {
    setEditParameters(editParameters.filter((_, i) => i !== index));
  }

  function handleEditParameterChange(index, field, value) {
    const next = [...editParameters];
    next[index] = { ...next[index], [field]: value };
    setEditParameters(next);
  }

  async function handleUpdateMethod() {
    if (!editingMethodId) return;

    if (!editMethodName.trim()) {
      toast.error("Method name is required");
      return;
    }

    if (!editMethodDescription.trim()) {
      toast.error("Method description is required");
      return;
    }

    const validParams = editParameters.filter((param) => param.name.trim());
    if (validParams.length === 0) {
      toast.error("At least one parameter is required");
      return;
    }

    setUpdatingMethod(true);
    try {
      await api.updateMethod(editingMethodId, {
        name: editMethodName,
        description: editMethodDescription,
        parameters: validParams,
        groovyScript: editMethodScript.trim() ? editMethodScript : null,
      });
      await fetchMethods();
      cancelEditMethod();
      toast.success("Method updated successfully");
    } catch (err) {
      toast.error("Failed to update method: " + err.message);
    } finally {
      setUpdatingMethod(false);
    }
  }

  async function handleSaveMethod(methodId) {
    setSavingMethodId(methodId);
    try {
      await api.saveMethod(methodId);
      await fetchMethods();
      toast.success("Method saved successfully");
    } catch (err) {
      toast.error("Failed to save method: " + err.message);
    } finally {
      setSavingMethodId(null);
    }
  }

  async function handleDiscardMethod(methodId) {
    if (!window.confirm("Discard this draft method? This cannot be undone.")) {
      return;
    }

    setDiscardingMethodId(methodId);
    try {
      await api.discardMethod(methodId);
      if (String(methodId) === testMethodId) {
        setTestMethodId("");
        setTestParameters({});
        setTestResult(null);
      }
      await fetchMethods();
      toast.success("Method discarded successfully");
    } catch (err) {
      toast.error("Failed to discard method: " + err.message);
    } finally {
      setDiscardingMethodId(null);
    }
  }

  function startAttachMethod(method) {
    setAttachingMethodId(method.id);
    
    // Initialize parameter bindings for all parameters
    const bindings = {};
    if (Array.isArray(method.parameters)) {
      method.parameters.forEach((param) => {
        bindings[param.name] = "";
      });
    }
    setAttachParameterBindings(bindings);
  }

  function cancelAttachMethod() {
    setAttachingMethodId(null);
    setAttachParameterBindings({});
  }

  function handleAttachParameterBindingChange(paramName, value) {
    setAttachParameterBindings({
      ...attachParameterBindings,
      [paramName]: value,
    });
  }

  async function handleAttachMethodToStep() {
    if (!attachingMethodId || !flowId || !stepId) {
      toast.error("Missing method, flow, or step information");
      return;
    }

    setAttachingToStep(true);
    try {
      await api.attachMethodToStep(flowId, stepId, {
        methodId: attachingMethodId,
        parameterBindings: attachParameterBindings,
      });
      
      cancelAttachMethod();
      toast.success("Method attached to step successfully");
    } catch (err) {
      toast.error("Failed to attach method: " + err.message);
    } finally {
      setAttachingToStep(false);
    }
  }

  function handleAddParameter() {
    setParameters([
      ...parameters,
      { name: "", type: "", description: "", required: false }
    ]);
  }

  function handleRemoveParameter(index) {
    setParameters(parameters.filter((_, i) => i !== index));
  }

  function handleParameterChange(index, field, value) {
    const newParams = [...parameters];
    newParams[index] = { ...newParams[index], [field]: value };
    setParameters(newParams);
  }

  async function handleGenerateMethod() {
    if (!methodName.trim()) {
      toast.error("Method name is required");
      return;
    }

    if (!methodDescription.trim()) {
      toast.error("Method description is required");
      return;
    }

    const validParams = parameters.filter(p => p.name.trim());
    if (validParams.length === 0) {
      toast.error("At least one parameter is required");
      return;
    }

    setGeneratingMethod(true);
    try {
      await api.generateMethod({
        name: methodName,
        description: methodDescription,
        parameters: validParams
      });

      await fetchMethods();
      setMethodName("");
      setMethodDescription("");
      setParameters([{ name: "", type: "", description: "", required: false }]);
      setShowGenerateForm(false);
      toast.success("Method generated successfully");
    } catch (err) {
      toast.error("Failed to generate method: " + err.message);
    } finally {
      setGeneratingMethod(false);
    }
  }

  async function handleTestMethod() {
    if (!testMethodId) {
      toast.error("Please select a method to test");
      return;
    }

    setTestingMethod(true);
    try {
      const result = await api.testMethod(parseInt(testMethodId), testParameters);
      setTestResult(result);
      toast.success("Method tested successfully");
    } catch (err) {
      toast.error("Failed to test method: " + err.message);
    } finally {
      setTestingMethod(false);
    }
  }

  function handleTestParameterChange(key, value) {
    setTestParameters({ ...testParameters, [key]: value });
  }

  const selectedMethod = methods.find((method) => method.id === parseInt(testMethodId));

  return (
    <div className={styles.container}>
      {/* Available Methods Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>Available Methods</h3>
          <Button
            size="small"
            onClick={() => setShowGenerateForm(!showGenerateForm)}
          >
            {showGenerateForm ? "Cancel" : "+ Generate Custom Method"}
          </Button>
        </div>

        {loading ? (
          <div className={styles.loading}>Loading methods...</div>
        ) : methods.length === 0 ? (
          <div className={styles.emptyState}>
            No methods available. Create a custom method to get started.
          </div>
        ) : (
          <div className={styles.methodsList}>
            {methods.map((method) => (
              <div key={method.id} className={styles.methodCard}>
                <div className={styles.methodHeader}>
                  <div className={styles.methodTitleWrap}>
                    <h4>{method.name}</h4>
                    <span className={styles.methodType}>
                      {method.type === "BUILTIN" ? "Built-in" : method.global ? "Saved" : "Draft"}
                    </span>
                  </div>
                  <span className={styles.methodId}>ID: {method.id}</span>
                </div>
                <p className={styles.methodDescription}>{method.description}</p>
                {method.parameters && method.parameters.length > 0 && (
                  <div className={styles.parameters}>
                    <strong>Parameters:</strong>
                    <ul>
                      {method.parameters.map((param, idx) => (
                        <li key={idx}>
                          <code>{param.name}</code> ({param.type})
                          {param.required && <span className={styles.required}>*</span>}
                          {param.description && <span className={styles.paramDesc}> - {param.description}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className={styles.methodActions}>
                  {isUserDefinedMethod(method) && (
                    <>
                      <Button
                        variant="secondary"
                        size="small"
                        icon={<IconEdit size={14} />}
                        onClick={() =>
                          editingMethodId === method.id ? cancelEditMethod() : startEditMethod(method)
                        }
                      >
                        {editingMethodId === method.id ? "Cancel Edit" : "Edit"}
                      </Button>

                      {!method.global && (
                        <Button
                          size="small"
                          onClick={() => handleSaveMethod(method.id)}
                          disabled={savingMethodId === method.id}
                        >
                          {savingMethodId === method.id ? "Saving..." : "Save"}
                        </Button>
                      )}

                      {!method.global && (
                        <Button
                          variant="danger"
                          size="small"
                          onClick={() => handleDiscardMethod(method.id)}
                          disabled={discardingMethodId === method.id}
                        >
                          {discardingMethodId === method.id ? "Discarding..." : "Discard"}
                        </Button>
                      )}
                    </>
                  )}

                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() =>
                      attachingMethodId === method.id ? cancelAttachMethod() : startAttachMethod(method)
                    }
                  >
                    {attachingMethodId === method.id ? "Cancel" : "Attach to Step"}
                  </Button>
                </div>

                {editingMethodId === method.id && (
                  <div className={styles.editForm}>
                    <Input
                      label="Method Name"
                      value={editMethodName}
                      onChange={(e) => setEditMethodName(e.target.value)}
                      placeholder="Method name"
                    />

                    <Textarea
                      label="Description"
                      rows={3}
                      value={editMethodDescription}
                      onChange={(e) => setEditMethodDescription(e.target.value)}
                      placeholder="Describe what this method does"
                    />

                    <Textarea
                      label="Groovy Script (Optional)"
                      rows={5}
                      mono
                      value={editMethodScript}
                      onChange={(e) => setEditMethodScript(e.target.value)}
                      placeholder="Leave empty to allow LLM regeneration from description"
                    />

                    <div className={styles.formGroup}>
                      <label className={styles.label}>Parameters</label>
                      <div className={styles.parametersList}>
                        {editParameters.map((param, idx) => (
                          <div key={idx} className={styles.parameterRow}>
                            <Input
                              placeholder="Parameter name"
                              value={param.name}
                              onChange={(e) =>
                                handleEditParameterChange(idx, "name", e.target.value)
                              }
                            />
                            <Input
                              placeholder="Type"
                              value={param.type}
                              onChange={(e) =>
                                handleEditParameterChange(idx, "type", e.target.value)
                              }
                            />
                            <Input
                              placeholder="Description"
                              value={param.description}
                              onChange={(e) =>
                                handleEditParameterChange(idx, "description", e.target.value)
                              }
                            />
                            <label className={styles.checkboxLabel}>
                              <input
                                type="checkbox"
                                checked={param.required}
                                onChange={(e) =>
                                  handleEditParameterChange(idx, "required", e.target.checked)
                                }
                              />
                              Required
                            </label>
                            {editParameters.length > 1 && (
                              <IconButton
                                size="small"
                                variant="ghost"
                                onClick={() => handleRemoveEditParameter(idx)}
                              >
                                <IconDelete size={16} />
                              </IconButton>
                            )}
                          </div>
                        ))}
                      </div>
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={handleAddEditParameter}
                        style={{ marginTop: "8px" }}
                      >
                        + Add Parameter
                      </Button>
                    </div>

                    <div className={styles.editActions}>
                      <Button
                        variant="secondary"
                        onClick={cancelEditMethod}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleUpdateMethod}
                        disabled={updatingMethod}
                      >
                        {updatingMethod ? "Updating..." : "Update Method"}
                      </Button>
                    </div>
                  </div>
                )}

                {attachingMethodId === method.id && (
                  <div className={styles.attachForm}>
                    {method.parameters && method.parameters.length > 0 ? (
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Parameter Bindings</label>
                        <div className={styles.bindingsList}>
                          {method.parameters.map((param) => (
                            <div key={param.name} className={styles.bindingRow}>
                              <label className={styles.bindingLabel}>
                                {param.name}
                                {param.required && <span className={styles.required}>*</span>}
                              </label>
                              <Input
                                placeholder={`e.g. {stepName.response.field}`}
                                value={attachParameterBindings[param.name] || ""}
                                onChange={(e) =>
                                  handleAttachParameterBindingChange(param.name, e.target.value)
                                }
                              />
                              {param.description && (
                                <span className={styles.bindingHint}>{param.description}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className={styles.methodDescription}>
                        This method has no parameters. Click Attach to Step to add it.
                      </p>
                    )}

                    <div className={styles.attachActions}>
                      <Button
                        variant="secondary"
                        onClick={cancelAttachMethod}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleAttachMethodToStep}
                        disabled={attachingToStep}
                      >
                        {attachingToStep ? "Attaching..." : "Attach to Step"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Generate Custom Method Section */}
      {showGenerateForm && (
        <div className={styles.section}>
          <h3>Generate Custom Method</h3>
          <div className={styles.formGroup}>
            <Input
              label="Method Name"
              placeholder="e.g. ValidateUser"
              value={methodName}
              onChange={(e) => setMethodName(e.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <Textarea
              label="Method Description"
              placeholder="Describe what this method does..."
              value={methodDescription}
              onChange={(e) => setMethodDescription(e.target.value)}
              rows={3}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Parameters</label>
            <div className={styles.parametersList}>
              {parameters.map((param, idx) => (
                <div key={idx} className={styles.parameterRow}>
                  <Input
                    placeholder="Parameter name"
                    value={param.name}
                    onChange={(e) =>
                      handleParameterChange(idx, "name", e.target.value)
                    }
                  />
                  <Input
                    placeholder="Type (string, number, boolean)"
                    value={param.type}
                    onChange={(e) =>
                      handleParameterChange(idx, "type", e.target.value)
                    }
                  />
                  <Input
                    placeholder="Description"
                    value={param.description}
                    onChange={(e) =>
                      handleParameterChange(idx, "description", e.target.value)
                    }
                  />
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={param.required}
                      onChange={(e) =>
                        handleParameterChange(idx, "required", e.target.checked)
                      }
                    />
                    Required
                  </label>
                  {parameters.length > 1 && (
                    <IconButton
                      size="small"
                      variant="ghost"
                      onClick={() => handleRemoveParameter(idx)}
                    >
                      <IconDelete size={16} />
                    </IconButton>
                  )}
                </div>
              ))}
            </div>
            <Button
              variant="secondary"
              size="small"
              onClick={handleAddParameter}
              style={{ marginTop: "8px" }}
            >
              + Add Parameter
            </Button>
          </div>

          <div className={styles.actionButtons}>
            <Button
              onClick={handleGenerateMethod}
              disabled={generatingMethod}
            >
              {generatingMethod ? "Generating..." : "Generate Method"}
            </Button>
          </div>
        </div>
      )}

      {/* Test Method Section */}
      <div className={styles.section}>
        <h3>Test Method</h3>
        <div className={styles.formGroup}>
          <label className={styles.label}>Select Method</label>
          <select
            value={testMethodId}
            onChange={(e) => {
              setTestMethodId(e.target.value);
              setTestParameters({});
              setTestResult(null);
            }}
            className={styles.select}
          >
            <option value="">-- Choose a method --</option>
            {methods.map((method) => (
              <option key={method.id} value={method.id}>
                {method.name} (ID: {method.id})
              </option>
            ))}
          </select>
        </div>

        {testMethodId && selectedMethod && (
          <div className={styles.formGroup}>
            <label className={styles.label}>Parameters</label>
            {selectedMethod?.parameters?.map((param) => (
                <Input
                  key={param.name}
                  label={`${param.name}${param.required ? "*" : ""}`}
                  placeholder={`Enter ${param.name}`}
                  value={testParameters[param.name] || ""}
                  onChange={(e) =>
                    handleTestParameterChange(param.name, e.target.value)
                  }
                />
              ))}
          </div>
        )}

        <Button
          onClick={handleTestMethod}
          disabled={testingMethod || !testMethodId}
        >
          {testingMethod ? "Testing..." : "Test Method"}
        </Button>

        {testResult && (
          <div className={styles.testResult}>
            <h4>Test Result:</h4>
            <pre>{JSON.stringify(testResult, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default MethodsTab;
