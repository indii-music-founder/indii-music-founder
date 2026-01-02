## 2025-05-23 - Firestore Rules Syntax Error & High Risk Defaults
**Vulnerability:** The `firestore.rules` file contained a syntax error in the `file_nodes` match block (truncated `allow read` statement and redundant, misplaced function definition). Additionally, `licenses` and `license_requests` allowed any authenticated user to read/write any document.
**Learning:** Syntax errors in security rules can silent-fail deployments or lead to default-deny behavior that breaks the app. Incomplete data models (missing `userId` on sensitive records) force developers into insecure "allow all authenticated" patterns.
**Prevention:**
1. Use VS Code extensions for Firestore Rules or the Firebase Emulator to validate syntax.
2. Ensure data models always include ownership metadata (`userId`, `orgId`) from day one to enable row-level security.
## 2025-05-23 - [CRITICAL] Firestore Rules Syntax Corruption
**Vulnerability:** The `firestore.rules` file contained a syntax error in the `file_nodes` match block. A function definition (`isProjectMember`) was pasted inside the rule body, and the `allow read` statement was malformed (missing closing parenthesis).
**Learning:** Syntax errors in security rules can lead to deployment failures, leaving the database in an undefined or default (potentially insecure or locked) state. Copy-pasting rules without verification is dangerous.
**Prevention:** Always use a linter or emulator to verify `firestore.rules` syntax before committing. In this environment, visual inspection and careful editing are key.
## 2025-05-24 - [CRITICAL] RAG Data Leak via Shared API Key
**Vulnerability:** The `ragProxy` function in `functions/src/index.ts` blindly forwards requests to `generativelanguage.googleapis.com` using a single server-side API Key. Because the Gemini Files API is scoped to the API Key (Project), not the user, any user can list, read, and delete files uploaded by ANY other user via the proxy.
**Learning:** Using a shared API Key for user-generated content in a third-party service (like Gemini) effectively removes multi-tenancy unless the proxy strictly intercepts and filters resources based on an internal ownership mapping.
**Prevention:**
1. Do not use shared API Keys for storage services without an intermediary ownership layer.
2. Implement a mapping in Firestore (`files/{fileId} -> { userId: '...' }`) and have the proxy verify ownership before forwarding `GET` or `DELETE` requests.
3. For `LIST` requests, do not forward to the upstream API; instead, query the internal Firestore mapping and only fetch permitted files.
