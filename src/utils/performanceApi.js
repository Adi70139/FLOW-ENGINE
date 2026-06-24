const BASE_URL = "http://localhost:8070";

function getAuthToken() {
  try {
    return localStorage.getItem("mr_auto_auth_token") || null;
  } catch {
    return null;
  }
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const token = getAuthToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 204) return null;

  let data;
  try {
    data = await response.json();
  } catch (e) {
    if (!response.ok) {
      throw new Error(`Server error: ${response.status} ${response.statusText}`, { cause: e });
    }
    return null;
  }

  if (!response.ok) {
    throw new Error(data?.error || data?.message || "Something went wrong");
  }
  return data;
}

export const performanceApi = {
  getApiBaseUrl: () => BASE_URL,
  getAuthToken,

  /** POST /performance/run */
  start: (requestBody) =>
    request("/performance/run", {
      method: "POST",
      body: JSON.stringify(requestBody),
    }),

  /** POST /performance/{runId}/cancel */
  cancel: (runId) =>
    request(`/performance/${runId}/cancel`, {
      method: "POST",
    }),

  /** GET /performance/{runId} */
  getResult: (runId) =>
    request(`/performance/${runId}`),

  /** GET /performance/{runId}/samples */
  getSamples: (runId) =>
    request(`/performance/${runId}/samples`),

  /** GET /performance/{runId}/rate */
  rate: (runId) =>
    request(`/performance/${runId}/rate`),

  /** GET /performance/history */
  getHistory: () =>
    request("/performance/history"),

  /** Returns connection details for the SSE stream */
  getStreamUrl: (runId) => `${BASE_URL}/performance/${runId}/stream`,

  /** GET /performance/apis */
  listApis: () =>
    request("/performance/apis"),

  /** GET /performance/apis/{id} */
  getApiById: (id) =>
    request(`/performance/apis/${id}`),

  /** POST /performance/apis */
  createApi: (apiData) =>
    request("/performance/apis", {
      method: "POST",
      body: JSON.stringify(apiData),
    }),

  /** PUT /performance/apis/{id} */
  updateApi: (id, apiData) =>
    request(`/performance/apis/${id}`, {
      method: "PUT",
      body: JSON.stringify(apiData),
    }),

  /** DELETE /performance/apis/{id} */
  deleteApi: (id) =>
    request(`/performance/apis/${id}`, {
      method: "DELETE",
    }),
};

