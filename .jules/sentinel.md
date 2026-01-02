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
**Vulnerability:** The `ragProxy` function (lines 352-385 in `functions/src/index.ts`) blindly forwarded all requests to `generativelanguage.googleapis.com` using the backend service's API key. This would allow any authenticated user to list, download, or delete *all* files uploaded to the project's Gemini Storage, regardless of who uploaded them, by calling endpoints like `GET /v1beta/files`.
**Learning:** Proxy functions that inject secrets (API keys) must implementing strict allowlisting of paths and methods. Never assume upstream APIs handle multi-tenant authorization (Gemini File API is project-global).
**Prevention:**
1. Implemented a strict `allowedPrefixes` list in `ragProxy` to only permit necessary operations.
2. Future: Move from global API keys to per-user Vertex AI OAuth tokens when possible.
