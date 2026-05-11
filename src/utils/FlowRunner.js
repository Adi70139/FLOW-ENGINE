/**
 * FlowRunner — Logic for sequential execution and variable chaining.
 */

/**
 * Replaces {{variable}} placeholders with values from the variables object.
 */
function substitute(str, variables = {}) {
  if (typeof str !== "string") return str;
  return str.replace(/\{\{(.+?)\}\}/g, (match, key) => {
    return variables[key.trim()] !== undefined ? variables[key.trim()] : match;
  });
}

/**
 * Extracts a value from an object using a dot-notation path (e.g. "data.user.id")
 */
function getValueByPath(obj, path) {
  if (!path) return undefined;
  return path.split('.').reduce((acc, part) => {
    if (acc === undefined || acc === null) return undefined;
    
    // Handle array brackets: e.g. "users[0]"
    const arrayMatch = part.match(/(.+)\[(\d+)\]/);
    if (arrayMatch) {
      const [, key, index] = arrayMatch;
      return acc[key] ? acc[key][parseInt(index, 10)] : undefined;
    }
    
    return acc[part];
  }, obj);
}

/**
 * Recursively flattens an object into key-value pairs
 */
function flattenObject(obj, prefix = '') {
  let results = {};
  for (const key in obj) {
    const value = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(results, flattenObject(value, newKey));
    } else {
      results[newKey] = value;
    }
  }
  return results;
}

/**
 * Executes a single test and extracts variables
 */
export async function runTest(test, flowVariables = {}) {
  const url = substitute(test.endpoint, flowVariables);
  const method = test.method || "GET";
  
  const headers = (test.headers || [])
    .filter(h => h.enabled !== false && h.key)
    .reduce((acc, h) => {
      acc[h.key] = substitute(h.value, flowVariables);
      return acc;
    }, {});

  const body = substitute(test.payload, flowVariables);
  
  const opts = { method, headers };
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase()) && body) {
    opts.body = body;
  }

  try {
    const startTime = performance.now();
    const res = await fetch(url, opts);
    const elapsed = Math.round(performance.now() - startTime);
    const text = await res.text();
    
    let json = null;
    try { json = JSON.parse(text); } catch(e) {}

    const resHeaders = [];
    res.headers.forEach((value, key) => resHeaders.push({ key, value }));

    // Extract variables
    let extracted = {};

    // 1. Manual extraction rules
    if (json && test.extract) {
      test.extract.forEach(rule => {
        if (rule.key && rule.path) {
          const val = getValueByPath(json, rule.path);
          if (val !== undefined) extracted[rule.key] = val;
        }
      });
    }

    // 2. Auto-extraction (Flatten JSON)
    if (json) {
      const flattened = flattenObject(json);
      extracted = { ...flattened, ...extracted }; // Manual rules override auto
    }

    return {
      success: res.ok,
      response: {
        status: res.status,
        statusText: res.statusText,
        time: elapsed,
        size: new Blob([text]).size,
        body: text,
        headers: resHeaders,
      },
      extracted
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      response: {
        status: 0,
        statusText: "Network Error",
        body: error.message,
        headers: []
      }
    };
  }
}

/**
 * Runs all tests in a flow sequentially
 */
export async function runFlow(flow, onProgress) {
  let variables = { ...(flow.variables || {}) };
  const results = [];

  for (const test of flow.tests) {
    if (onProgress) onProgress(test.id, 'running');
    
    const result = await runTest(test, variables);
    results.push({ testId: test.id, ...result });
    
    if (result.extracted) {
      variables = { ...variables, ...result.extracted };
    }

    if (onProgress) onProgress(test.id, result.success ? 'success' : 'failed', result);
    
    // Optional: Stop on failure
    if (!result.success) break;
  }

  return { results, finalVariables: variables };
}
