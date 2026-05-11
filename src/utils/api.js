// const BASE_URL = "http://localhost:8060";
const BASE_URL = "https://api-orchestration.onrender.com";

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (response.status === 204) return null;

  let data;
  try {
    data = await response.json();
  } catch (e) {
    if (!response.ok) {
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }
    return null;
  }

  if (!response.ok) {
    // If backend returns field-level validation errors
    const errorMsg = typeof data === 'object' && !data.error
      ? Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(", ")
      : data.error || "Something went wrong";
    throw new Error(errorMsg);
  }
  return data;
}

/**
 * Mapper: Frontend Test -> Backend Step
 */
export const mapTestToStep = (test, index) => ({
  name: test.name,
  // description: test.description || "", // Assuming backend supports it now
  stepOrder: index + 1,
  method: test.method || "GET",
  url: test.endpoint || "https://api.example.com", // Default placeholder to prevent 'must not be blank'
  headersJson: test.headers && test.headers.length > 0 ? JSON.stringify(
    test.headers.reduce((acc, h) => {
      if (h.key && h.enabled !== false) acc[h.key] = h.value;
      return acc;
    }, {})
  ) : null,
  bodyJson: test.payload || null,
});

/**
 * Mapper: Backend Step -> Frontend Test
 */
export const mapStepToTest = (step) => ({
  id: step.id,
  name: step.name,
  description: step.description || "",
  method: step.method,
  endpoint: step.url,
  headers: (() => {
    try {
      return step.headersJson ? Object.entries(JSON.parse(step.headersJson)).map(([key, value]) => ({
        key, value, enabled: true
      })) : [];
    } catch (e) {
      console.warn("Failed to parse headersJson:", step.headersJson);
      return [];
    }
  })(),
  payload: step.bodyJson || "",
  stepOrder: step.stepOrder,
  requiredParams: step.requiredParams || null,
  extract: [], // Backend auto-extracts, so we don't need local rules anymore
  response: null,
});

export const api = {
  // Modules
  getModules: () => request("/modules"),
  createModule: (data) => request("/modules", {
    method: "POST",
    body: JSON.stringify({
      name: data.name,
      description: data.description
    }),
  }),
  updateModule: (id, data) => request(`/modules/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      name: data.name,
      description: data.description
    }),
  }),
  deleteModule: (id) => request(`/modules/${id}`, { method: "DELETE" }),

  // Flows
  getFlows: () => request("/flows"),
  // Flows By Module (if supported, otherwise this might fail)
  // Flows By Module (uses name as per FlowController.java)
  getFlowsByModule: (moduleName) => request(`/flows/module/${encodeURIComponent(moduleName)}`),
  createFlow: (data, moduleName) => request("/flows", {
    method: "POST",
    body: JSON.stringify({
      name: data.name,
      description: data.description,
      module: moduleName
    }),
  }),
  updateFlow: (id, data, moduleName) => request(`/flows/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      name: data.name,
      description: data.description,
      module: moduleName
    }),
  }),
  deleteFlow: (id) => request(`/flows/${id}`, { method: "DELETE" }),

  // Steps
  getSteps: (flowId) => request(`/flows/${flowId}/steps`),
  createStep: (flowId, test, index) => request(`/flows/${flowId}/steps`, {
    method: "POST",
    body: JSON.stringify(mapTestToStep(test, index)),
  }),
  updateStep: (flowId, stepId, test, index) => request(`/flows/${flowId}/steps/${stepId}`, {
    method: "PUT",
    body: JSON.stringify(mapTestToStep(test, index)),
  }),
  deleteStep: (flowId, stepId) => request(`/flows/${flowId}/steps/${stepId}`, {
    method: "DELETE"
  }),

  // Execution
  executeFlow: (flowId) => request(`/execute/flows/${flowId}`, { method: "POST" }),
  executeModule: (moduleId) => request(`/execute/modules/${moduleId}`, { method: "POST" }),
};
