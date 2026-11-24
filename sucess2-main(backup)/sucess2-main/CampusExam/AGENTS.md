# Strict Editing & Verification Rules
- ONLY modify files directly required for the explicitly requested change. Do NOT refactor, rename, or reformat unrelated frontend/backend code.
- Before modifying shared API contracts, database schemas, or authentication middleware, pause and ask for confirmation.
- After making any code change, do NOT finish the task until you have tested the live app in the browser.
- Open the running dev server, walk through the login flow and every affected button/screen, check browser console logs and network requests for errors, and capture screenshots/recordings of the output.
## Multi-Portal Architecture & Strict Testing Rules
- **Backend:** `CampusExam.java` (PostgreSQL `campusexam`)
- **Frontend Portals:**
  1. Admin Portal: `frontend/admin-portal`
  2. CoE Portal: `frontend/coe-portal`
  3. Student Portal: `frontend/student-portal (Final)`

### Scope Protection
- ONLY modify the specific portal folder(s) and `CampusExam.java` endpoints explicitly requested by the user.
- NEVER refactor, rename, or alter files in the other portals unless explicitly instructed.
- Do NOT rename `student-portal (Final)` or alter `schema.sql` without explicit user approval.

### Mandatory Live Browser Verification
- After making any change, open the running `localhost` URL(s) for every affected portal using the Browser Subagent.
- Log in using test credentials, click through every modified screen and button, verify network API calls (`200 OK`) and console logs, and produce a Walkthrough recording/screenshots showing the live UI state after each action.