# Backend Integration Guide for MrAutomation

This guide explains how to migrate the **MrAutomation** frontend from `localStorage` to a real persistent backend (Node.js, Python, Go, etc.).

## 1. High-Level Architecture

Currently, the app follows this flow:
`UI Components` -> `CollectionContext` -> `localStorage`

To integrate a backend, the flow changes to:
`UI Components` -> `CollectionContext` -> `API Service` -> `Backend Server` -> `Database`

---

## 2. Setting up the API Service

Create a new file `src/services/api.js` to handle all network requests to your backend.

```javascript
const BASE_URL = 'https://your-backend-api.com';

export const ApiService = {
  // Fetch all modules
  async getModules() {
    const res = await fetch(`${BASE_URL}/modules`);
    return res.json();
  },

  // Save a new module
  async createModule(moduleData) {
    const res = await fetch(`${BASE_URL}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(moduleData),
    });
    return res.json();
  },

  // Update a test
  async updateTest(flowId, testId, patch) {
    const res = await fetch(`${BASE_URL}/flows/${flowId}/tests/${testId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    return res.json();
  }
};
```

---

## 3. Modifying the Context Layer

In `src/context/CollectionContext.jsx`, you need to replace the local persistence logic.

### A. Initialization
Instead of `loadState()` pulling from `localStorage`, use a `useEffect` inside the `ModuleProvider` to fetch data from your API.

```javascript
export function ModuleProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, { modules: [], ... });

  useEffect(() => {
    ApiService.getModules().then(modules => {
      dispatch({ type: 'SET_INITIAL_STATE', modules });
    });
  }, []);

  // ...
}
```

### B. Updating Actions
When a user clicks "Create Module", you should call the API first, then update the state with the response from the server.

---

## 4. Backend Requirements (CORS)

Your backend MUST enable **CORS** to allow requests from your frontend domain (e.g., `localhost:5173`).

**Node.js (Express) Example:**
```javascript
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors()); // Enable CORS for all routes
app.use(express.json());

// Example endpoint
app.get('/modules', (req, res) => {
  const modules = db.getModules(); // Get from your DB
  res.json(modules);
});

app.listen(3000);
```

---

## 5. Recommended Database Structure

We recommend a document-based store (like **MongoDB**) or a relational store (like **PostgreSQL**) with the following schema:

*   **Modules Table**: `id`, `name`, `description`
*   **Flows Table**: `id`, `module_id`, `name`, `variables` (JSON)
*   **Tests Table**: `id`, `flow_id`, `name`, `method`, `endpoint`, `headers` (JSON), `payload`, `extract` (JSON)

---

## 6. Migration Checklist

1. [ ] Set up your backend server and database.
2. [ ] Create the API endpoints matching the MrAutomation structure.
3. [ ] Update `src/services/api.js` with your backend URL.
4. [ ] Swap `localStorage` calls in `CollectionContext.jsx` for `ApiService` calls.
5. [ ] (Optional) Add Authentication (JWT) to protect your modules.
