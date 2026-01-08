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
## 2025-05-25 - Firestore Rules Duplicate Matches
**Vulnerability:** The `firestore.rules` file contained two separate `match /deployments/{deploymentId}` blocks. The first block (User Scoped) was missing its closing brace `}`, causing a syntax error that effectively merged the subsequent Org Scoped block into it or caused a parse failure.
**Learning:** Copy-pasting rule blocks without verifying closure syntax can lead to invalid security configurations. Firestore rules must have unique match paths at the same nesting level.
**Prevention:**
1.  Visually verify indentation and braces when merging rules.
2.  Combine conditions for the same resource into a single match block using logical OR (`||`) operators.
## 2025-05-26 - [CRITICAL] Unrestricted Administrative Functions
**Vulnerability:** The `functions/src/index.ts` file exposed sensitive DevOps and Analytics functions (`listGKEClusters`, `restartGCEInstance`, `executeBigQueryQuery`, etc.) via `onCall` triggers that only checked for authentication (`!context.auth`), but not for administrative privileges. This would allow any authenticated user to restart production instances, scale clusters, or execute arbitrary SQL.
**Learning:** Checking `context.auth` is insufficient for administrative tools. Cloud Functions do not have inherent Role-Based Access Control (RBAC) unless explicitly implemented.
**Prevention:**
1.  Implemented `requireAdmin` helper function that enforces a strict check for `context.auth.token.admin === true` (Firebase Custom Claim).
2.  Applied this check to all sensitive functions.
3.  Default behavior is now "Deny All" for these functions until an admin script explicitly grants the claim.
## 2026-01-08 - [CRITICAL] SSRF & Local File Inclusion in Electron Network Handler
**Vulnerability:** The `net:fetch-url` IPC handler in `electron/handlers/network.ts` accepted any URL string from the renderer and passed it directly to `fetch()`. This allowed a compromised renderer (e.g., via XSS) to read local files (e.g., `file:///etc/passwd`) or access internal network services (e.g., AWS Metadata at `http://169.254.169.254/latest/meta-data/`).
**Learning:** Never trust inputs from the renderer, even in IPC handlers. The "Main process is the guard" must actively validate all requests. Default `fetch` implementations in Node/Electron can be surprisingly powerful (accessing file/local network).
**Prevention:**
1.  Implemented `validateSafeUrl` in `electron/handlers/network.ts`.
2.  Enforced strict protocol allowing (`http:`, `https:` only).
3.  Blocked access to `localhost`, loopback addresses, and private RFC1918 IP ranges (10.x, 192.168.x, 172.16.x).
4.  Blocked access to Cloud Metadata IP (169.254.169.254).
## 2025-05-27 - [HIGH] Unrestricted IPC Network Proxy (SSRF)
**Vulnerability:** The `net:fetch-url` IPC handler in `electron/handlers/network.ts` accepted any URL from the renderer and executed a `fetch` request from the Main process. This bypassed the Renderer's CORS policies and allowed a compromised renderer (e.g., via XSS) to scan the user's local network (localhost, 192.168.x.x) or access cloud metadata services (169.254.169.254).
**Learning:** Electron's Main process acts as a privileged proxy. Blindly forwarding requests from the UI breaks the "Untrusted UI" security model.
**Prevention:**
1.  Implemented strict `Zod` validation for all IPC payloads.
2.  Blocked private IP ranges (RFC1918) and localhost in `net:fetch-url`.
3.  Enforced strict protocol checks (HTTP/HTTPS only).
