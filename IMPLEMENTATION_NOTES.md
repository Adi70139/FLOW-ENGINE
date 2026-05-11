# Chaining & Stitching APIs in MrAutomation

This document explains how to use the newly implemented variable chaining system to "stitch" multiple APIs together.

## 1. How it works
The system uses a 3-step process to pass data between requests in a **Flow**:
1.  **Extract**: After a request finishes, the system looks at the JSON response.
2.  **Store**: It pulls specific values (like an `id` or `token`) based on your rules and stores them in the Flow's memory.
3.  **Inject**: Subsequent requests in the same flow can use these values by placing `{{variableName}}` in the URL, Headers, or Body.

---

## 2. Setting up an Extraction Rule
To pull data from a response:
1.  Go to the **Tests/Extract** tab in the Request Editor.
2.  In the **Variable Name** column, give it a name (e.g., `userToken`).
3.  In the **JSON Path** column, specify where the value is in the response using dot-notation:
    -   `token` (if the response is `{ "token": "..." }`)
    -   `data.user.id` (if the response is `{ "data": { "user": { "id": 1 } } }`)
    -   `items[0].id` (to get the ID of the first item in an array)

---

## 3. Using the Variable
Once extracted, you can use the variable anywhere in the following requests:
-   **URL**: `https://api.example.com/profile/{{userId}}`
-   **Headers**: `Authorization: Bearer {{userToken}}`
-   **Body**: 
    ```json
    { "owner_id": "{{userId}}" }
    ```

---

## 4. Running the "Stitch"
1.  Navigate to the **Sidebar**.
2.  Click the **Run (▶)** button on the Flow header.
3.  The system will:
    -   Execute the first test.
    -   Extract variables.
    -   Automatically inject them into the second test.
    -   Repeat until the end of the flow.

---

## 5. Implementation Notes for Further Expansion

### Handling CORS
Since this is a client-side tool, some APIs might block requests due to CORS. 
**Solution**: In a production environment, implement a simple Node.js proxy that forwards requests from the browser to the destination API.

### Environment Variables
Currently, variables are scoped to a **Flow**. 
**Future Update**: Add a "Global Environment" selector (e.g., Development, Production) to store base URLs and static API keys that apply to all modules.

### Post-Request Scripts
The current system uses JSON Path for extraction.
**Future Update**: Add a Javascript sandbox (using `eval` or a safer alternative) to allow complex logic:
```javascript
// Example post-request script
const body = JSON.parse(response.body);
if (body.status === 'active') {
  setVariable('nextStep', 'approve');
}
```
