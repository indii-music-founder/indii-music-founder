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

## 2025-05-21 - [Insecure Randomness in Business Identifiers]
**Vulnerability:** The `MerchandiseService` used `Math.random()` to generate `orderId` values. `Math.random()` is not cryptographically secure, leading to potentially predictable identifiers.
**Learning:** Even for non-secret values like Order IDs, using insecure randomness can create bad habits and theoretical predictability vectors (e.g. guessing the next order ID to probe for existence).
**Prevention:** Replaced `Math.random()` with `crypto.getRandomValues()` to generate a secure 9-character alphanumeric string, maintaining the existing `BANA-` format while ensuring cryptographic strength.
