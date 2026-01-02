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
