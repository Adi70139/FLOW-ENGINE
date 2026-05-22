//const BASE_URL = "https://api-orchestration.onrender.com";
const BASE_URL = "http://localhost:8060";

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
    const errorMsg =
      typeof data === "object" && !data.error
        ? Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(", ")
        : data.error || "Something went wrong";
    throw new Error(errorMsg);
  }
  return data;
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

const DEFAULT_TIMEZONE = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

function timeToCronExpression(time = "00:00") {
  const [hour = "0", minute = "0"] = String(time).split(":");
  return `${parseInt(minute, 10) || 0} ${parseInt(hour, 10) || 0} * * *`;
}

function cronExpressionToTime(cronExpression) {
  if (!cronExpression || typeof cronExpression !== "string") return null;
  const [minute, hour] = cronExpression.trim().split(/\s+/);
  if (minute == null || hour == null || minute.includes("*") || hour.includes("*")) {
    return null;
  }

  const parsedHour = parseInt(hour, 10);
  const parsedMinute = parseInt(minute, 10);
  if (Number.isNaN(parsedHour) || Number.isNaN(parsedMinute)) return null;

  return `${String(parsedHour).padStart(2, "0")}:${String(parsedMinute).padStart(2, "0")}`;
}

export function normalizeSchedule(schedule) {
  if (!schedule) return null;

  const time =
    schedule.time ||
    schedule.executionTime ||
    schedule.localTime ||
    cronExpressionToTime(schedule.cronExpression) ||
    "00:00";

  return {
    ...schedule,
    time,
    timezone: schedule.timezone || schedule.zoneId || DEFAULT_TIMEZONE(),
    active: schedule.active !== false && schedule.enabled !== false,
    cronExpression: schedule.cronExpression || timeToCronExpression(time),
  };
}

export function mapScheduleToApi(data) {
  const time = data?.time || cronExpressionToTime(data?.cronExpression) || "00:00";
  const timezone = data?.timezone || DEFAULT_TIMEZONE();

  return {
    time,
    timezone,
  };
}

/** Frontend Test shape → Backend Step body */
export const mapTestToStep = (test) => ({
  name: test.name,
  description: test.description || "",
  method: test.method || "GET",
  url: test.endpoint || "https://api.example.com",
  headersJson:
    test.headers && test.headers.length > 0
      ? JSON.stringify(
        test.headers.reduce((acc, h) => {
          if (h.key && h.enabled !== false) acc[h.key] = h.value;
          return acc;
        }, {})
      )
      : null,
  bodyJson: test.payload || null,
  assertions: test.assertions || null,
  retryCount: typeof test.retryCount === "number" ? test.retryCount : (parseInt(test.retryCount) || 0),
  retryDelayMs: typeof test.retryDelayMs === "number" ? test.retryDelayMs : (parseInt(test.retryDelayMs) || 0),
  initialDelayMs: typeof test.initialDelayMs === "number" ? test.initialDelayMs : (parseInt(test.initialDelayMs) || 0),
  pollUntilSuccess: !!test.pollUntilSuccess,
  pollIntervalMs: typeof test.pollIntervalMs === "number" ? test.pollIntervalMs : (parseInt(test.pollIntervalMs) || 0),
  pollMaxAttempts: typeof test.pollMaxAttempts === "number" ? test.pollMaxAttempts : (parseInt(test.pollMaxAttempts) || 0),
  pollExpectedStatus: typeof test.pollExpectedStatus === "number" ? test.pollExpectedStatus : (parseInt(test.pollExpectedStatus) || 0),
});

/** Backend Step → Frontend Test shape */
export const mapStepToTest = (step) => {
  let cachedResponse = null;
  try {
    const raw = localStorage.getItem(`mr_auto_step_response_${step.id}`);
    if (raw) {
      cachedResponse = JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Failed to read/parse cached response from localStorage:", e);
  }

  return {
    id: step.id,
    name: step.name,
    description: step.description || "",
    method: step.method,
    endpoint: step.url,
    headers: (() => {
      try {
        return step.headersJson
          ? Object.entries(JSON.parse(step.headersJson)).map(([key, value]) => ({
            key,
            value,
            enabled: true,
          }))
          : [];
      } catch (e) {
        console.warn("Failed to parse headersJson:", step.headersJson);
        return [];
      }
    })(),
    payload: step.bodyJson,
    assertions: step.assertionsJson ? JSON.parse(step.assertionsJson) : null,
    retryCount: step.retryCount || 0,
    retryDelayMs: step.retryDelayMs || 0,
    initialDelayMs: step.initialDelayMs || 0,
    pollUntilSuccess: !!step.pollUntilSuccess,
    pollIntervalMs: step.pollIntervalMs || 0,
    pollMaxAttempts: step.pollMaxAttempts || 0,
    pollExpectedStatus: step.pollExpectedStatus || 0,
    response: cachedResponse,
  };
};


// ─── API ──────────────────────────────────────────────────────────────────────

export const api = {
  // ── Modules ──────────────────────────────────────────────────────────────
  getModules: () => request("/modules"),
  getModule: (id) => request(`/modules/${id}`),
  createModule: (data) =>
    request("/modules", { method: "POST", body: JSON.stringify(data) }),
  /** FIX: was missing from original api.js — UpdateModuleModal needs this */
  updateModule: (id, data) =>
    request(`/modules/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteModule: (id) => request(`/modules/${id}`, { method: "DELETE" }),

  // ── Flows ─────────────────────────────────────────────────────────────────
  getFlows: () => request("/flows"),
  getFlow: (id) => request(`/flows/${id}`),
  getFlowsByModule: (moduleName) =>
    request(`/flows/module/${encodeURIComponent(moduleName)}`),
  createFlow: (data, moduleName) =>
    request("/flows", {
      method: "POST",
      body: JSON.stringify({
        name: data.name,
        description: data.description,
        module: moduleName,
        environmentId: data.environmentId,
      }),
    }),
  updateFlow: (id, data, moduleName) =>
    request(`/flows/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: data.name,
        description: data.description,
        module: moduleName,
      }),
    }),
  deleteFlow: (id) => request(`/flows/${id}`, { method: "DELETE" }),
  duplicateFlow: (id, data) =>
    request(`/flows/${id}/duplicate`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** PUT /flows/:id/environment/:envId — assign an environment to a flow */
  updateFlowEnv: (id, envId) =>
    request(`/flows/${id}/environment/${envId}`, { method: "PUT" }),
  /** DELETE /flows/:id/environment — clear environment from a flow */
  clearFlowEnv: (id) =>
    request(`/flows/${id}/environment`, { method: "DELETE" }),

  // ── Steps ─────────────────────────────────────────────────────────────────
  getSteps: (flowId) => request(`/flows/${flowId}/steps`),
  getStep: (flowId, stepId) => request(`/flows/${flowId}/steps/${stepId}`),
  createStep: (flowId, test) =>
    request(`/flows/${flowId}/steps`, {
      method: "POST",
      body: JSON.stringify(mapTestToStep(test)),
    }),
  updateStep: (flowId, stepId, test) =>
    request(`/flows/${flowId}/steps/${stepId}`, {
      method: "PUT",
      body: JSON.stringify(mapTestToStep(test)),
    }),
  deleteStep: (flowId, stepId) =>
    request(`/flows/${flowId}/steps/${stepId}`, { method: "DELETE" }),
  duplicateStep: (flowId, stepId, name) =>
    request(`/flows/${flowId}/steps/${stepId}/duplicate`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  reorderSteps: (flowId, steps) =>
    request(`/flows/${flowId}/steps/reorder`, {
      method: "PUT",
      body: JSON.stringify({ steps }),
    }),

  // ── Environments ──────────────────────────────────────────────────────────
  getModuleEnvironments: (moduleId) =>
    request(`/modules/${moduleId}/environments`),
  getEnvironment: (moduleId, envId) =>
    request(`/modules/${moduleId}/environments/${envId}`),
  createEnvironment: (moduleId, data) =>
    request(`/modules/${moduleId}/environments`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateEnvironment: (moduleId, envId, data) =>
    request(`/modules/${moduleId}/environments/${envId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteEnvironment: (moduleId, envId) =>
    request(`/modules/${moduleId}/environments/${envId}`, { method: "DELETE" }),

  // ── Scheduler ─────────────────────────────────────────────────────────────
  getModuleSchedule: async (moduleId) =>
    normalizeSchedule(await request(`/schedule/modules/${moduleId}`)),
  /** POST /schedule/modules/:moduleId  body: { cronExpression, envId? } */
  setModuleSchedule: async (moduleId, data) =>
    normalizeSchedule(await request(`/schedule/modules/${moduleId}`, {
      method: "POST",
      body: JSON.stringify(mapScheduleToApi(data)),
    })),
  deleteModuleSchedule: (moduleId) =>
    request(`/schedule/modules/${moduleId}`, { method: "DELETE" }),

  // ── Execution ─────────────────────────────────────────────────────────────
  executeFlow: (flowId, envId) =>
    request(`/execute/flows/${flowId}/async`, {
      method: "POST",
      body: JSON.stringify({ environmentId: envId ? parseInt(envId) : null }),
    }),
  getFlowExecutionStatus: (executionId) =>
    request(`/execute/flows/runs/${executionId}/status`),
  /** POST /execute/modules/:moduleId?envId=... */
  executeModule: (moduleId, envId) => {
    const url = envId
      ? `/execute/modules/${moduleId}?envId=${envId}`
      : `/execute/modules/${moduleId}`;
    return request(url, { method: "POST" });
  },
  /** POST /execute/modules/bulk  body: { ids, envIds? } */
  executeBulkModules: (ids, envIds) =>
    request("/execute/modules/bulk", {
      method: "POST",
      body: JSON.stringify({ ids, envIds }),
    }),
  /** POST /execute/flows/bulk  body: { ids, envIds? } */
  executeBulkFlows: (ids, envIds) =>
    request("/execute/flows/bulk", {
      method: "POST",
      body: JSON.stringify({ ids, envIds }),
    }),
  /** Convenience: picks endpoint by type ('module'|'flow') */
  executeBulk: (type, ids, envIds) => {
    const path =
      type === "module" ? "/execute/modules/bulk" : "/execute/flows/bulk";
    return request(path, {
      method: "POST",
      body: JSON.stringify({
        ids: (ids || []).map(id => parseInt(id)),
        envIds: (envIds || []).map(id => id ? parseInt(id) : null)
      }),
    });
  },
  /** GET /execute/bulk/:bulkJobId — poll job status */
  getBulkJobStatus: (bulkJobId) => request(`/execute/bulk/${bulkJobId}`),

  // ── Reports — PDF download URLs ───────────────────────────────────────────
  getFlowReport: (flowId) =>
    `${BASE_URL}/report/flows/${flowId}`,
  getModuleReport: (moduleExecutionId) =>
    `${BASE_URL}/report/module-executions/${moduleExecutionId}`,
  getBulkReport: (bulkJobId) => `${BASE_URL}/report/bulk/${bulkJobId}`,

  // ── Reports — JSON data ───────────────────────────────────────────────────
  /** GET /report/flows/:flowId/data */
  getFlowReportData: (flowId) =>
    request(`/report/flows/${flowId}/data`),
  /** GET /report/module-executions/:moduleExecutionId/data */
  getModuleReportData: (moduleExecutionId) =>
    request(`/report/module-executions/${moduleExecutionId}/data`),
  /** GET /report/bulk/:bulkJobId/data */
  getBulkReportData: (bulkJobId) =>
    request(`/report/bulk/${bulkJobId}/data`),

  // ── Assertions ───────────────────────────────────────────────────────────
  generateAssertions: ({ responseBody, description }) =>
    request("/assertions/generate", {
      method: "POST",
      body: JSON.stringify({ responseBody, description }),
    }),

  // ── Trends, History, & Graph ─────────────────────────────────────────────
  getStepTrends: (flowId) => request(`/api/flows/${flowId}/trends`),
  getFlowHistory: (flowId) => request(`/api/flows/${flowId}/history`),
  getDependencyGraph: (flowId) => request(`/api/flows/${flowId}/dependency-graph`),

  // ── Import ────────────────────────────────────────────────────────────────
  /** POST /import/postman  multipart: { file, flowName, moduleId } */
  importPostman: (file, flowName, moduleId) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("flowName", flowName);
    formData.append("moduleId", moduleId);

    // NOTE: For multipart/form-data, we must NOT set Content-Type manually
    // because the browser needs to set the boundary.
    return fetch(`${BASE_URL}/import/postman`, {
      method: "POST",
      body: formData,
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      return data;
    });
  },
};
