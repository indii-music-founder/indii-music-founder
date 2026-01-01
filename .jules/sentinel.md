## 2025-05-23 - [CRITICAL] Firestore Rules Syntax Corruption
**Vulnerability:** The `firestore.rules` file contained a syntax error in the `file_nodes` match block. A function definition (`isProjectMember`) was pasted inside the rule body, and the `allow read` statement was malformed (missing closing parenthesis).
**Learning:** Syntax errors in security rules can lead to deployment failures, leaving the database in an undefined or default (potentially insecure or locked) state. Copy-pasting rules without verification is dangerous.
**Prevention:** Always use a linter or emulator to verify `firestore.rules` syntax before committing. In this environment, visual inspection and careful editing are key.
