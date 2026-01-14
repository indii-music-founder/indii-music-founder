## 2025-05-18 - [IPC Defense-in-Depth]
**Vulnerability:** A logic inconsistency existed between two `validateSender` implementations. One implementation (`ipc-security.ts`) permissively allowed any `http`/`https` origin, while the other (`validation.ts`) correctly restricted access to `file://` and the development server. This could allow a compromised renderer frame or iframe to bypass sender validation checks if it could execute IPC calls.
**Learning:** Duplicate code is a security risk. When security primitives are copied, they drift apart, and the weaker version often becomes the one used by default.
**Prevention:** Consolidated `validateSender` into `electron/utils/ipc-security.ts` with strict origin checking (allowlist: `file://`, `indii-os://`, and `VITE_DEV_SERVER_URL`). Applied this validation to all critical IPC handlers in the main process, closing the defense-in-depth gap.

## 2025-05-19 - [Local File Exfiltration via Distribution Staging]
**Vulnerability:** The `distribution:stage-release` IPC handler allowed the renderer to copy arbitrary files from the user's filesystem into a temporary staging directory via the `fs.copyFile` operation. The handler only validated the *destination* filename (path traversal check) but failed to validate the *source* path (`file.data`).
**Risk:** High. A compromised renderer or malicious agent instruction could exploit this to copy sensitive files (e.g., `/etc/passwd`, `~/.ssh/id_rsa`, `.env`) into the staging area. Once staged, the attacker could theoretically exfiltrate them using the `sftp:upload-directory` handler, which treats the staging directory as a "safe" source.
**Learning:** Validating the output (destination) is not enough; the input (source) must also be trusted. When an agent acts on behalf of a user, it must be restricted to "user-intent" boundaries (like common media folders) rather than having root-equivalent read access.
**Prevention:** Implemented `validateSafeDistributionSource` in `electron/utils/security-checks.ts`. This enforces a strict allowlist of media extensions (wav, mp3, jpg, etc.) and explicitly blocks system directories (`/etc`, `/var`, `C:\Windows`) and hidden files/directories (`.ssh`, `.config`).

## 2025-05-20 - [Unvalidated IPC Payloads in Audio & Credential Handlers]
**Vulnerability:** Several IPC handlers (`audio:lookup-metadata`, `credentials:get`, `credentials:delete`) relied on manual type checking (e.g., `typeof id !== 'string'`) or lacked specific format validation.
**Risk:** Medium. While `validateSender` prevented unauthorized access, a compromised renderer could potentially send malformed data (like SQL injection strings or extremely long payloads) to the main process services (`CredentialService`, `APIService`), potentially causing denial of service or logic errors in the backend.
**Learning:** "Manual validation is fragile." Consistent schema validation (Zod) across *all* IPC boundaries ensures that the Main process only ever processes well-formed, typed data, acting as a robust firewall against renderer instability or compromise.
**Prevention:** Enforced Zod schema validation for all inputs in `electron/handlers/audio.ts` and `electron/handlers/credential.ts`. Added `AudioLookupSchema` (hex strings only) and `CredentialIdSchema` (alphanumeric/safe chars only) to strict validation.

## 2025-05-21 - [SFTP Local File Exfiltration via Symlink Bypass]
**Vulnerability:** The `sftp:upload-directory` handler verified that the source path was contained within `os.tmpdir()` or `userData` to prevent arbitrary file access. However, it used `path.resolve` without resolving symbolic links (`fs.realpath`). This allowed a compromised renderer (or an agent tricked into creating a symlink) to point a symlink inside the allowed temporary directory to a sensitive location (e.g., `/etc` or `/home/user/.ssh`), bypassing the containment check and exfiltrating sensitive files.
**Risk:** High. Allows a compromised process to read and upload any file the user has access to, bypassing the intended sandbox restrictions of the SFTP tool.
**Learning:** `path.resolve` normalizes strings but does not verify physical file structure. Security boundaries based on file paths must always resolve symbolic links (`fs.realpathSync`) before verifying containment to prevent Time-of-Check Time-of-Use (TOCTOU) or logical bypasses.
**Prevention:** Updated `electron/handlers/sftp.ts` to explicitly resolve the `localPath` using `fs.realpathSync` before performing the containment check against allowed roots.
## 2025-05-21 - [Insecure Randomness in Business Identifiers]
**Vulnerability:** The `MerchandiseService` used `Math.random()` to generate `orderId` values. `Math.random()` is not cryptographically secure, leading to potentially predictable identifiers.
**Learning:** Even for non-secret values like Order IDs, using insecure randomness can create bad habits and theoretical predictability vectors (e.g. guessing the next order ID to probe for existence).
**Prevention:** Replaced `Math.random()` with `crypto.getRandomValues()` to generate a secure 9-character alphanumeric string, maintaining the existing `BANA-` format while ensuring cryptographic strength.

## 2025-05-22 - [Unchecked Agent Agency in DevOps Tools]
**Vulnerability:** The `DevOpsTools.ts` allowed an Agent to execute destructive infrastructure changes (scaling clusters, restarting instances) without explicit human confirmation. While the *user* was authenticated as admin, a compromised Agent (via prompt injection or error) could abuse this authority to damage infrastructure.
**Learning:** "Agency without Authorization is a vulnerability." Just because a *user* has permission doesn't mean the *agent* should automatically inherit the right to execute sensitive actions without a "human-in-the-loop" check.
**Prevention:** Implemented a mandatory `requireApproval` check within `scale_deployment` and `restart_service` tools, enforcing a critical-level human approval dialog before execution.
