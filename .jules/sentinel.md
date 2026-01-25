## 2025-02-18 - [CRITICAL] Symlink Traversal in Distribution Handlers
**Vulnerability:** The `validateSafeDistributionSource` function in `electron/utils/security-checks.ts` validated file paths using `path.normalize()` but failed to resolve symbolic links. This allowed a malicious user (or compromised project) to bypass the system directory blocklist by creating a symlink (e.g., `song.wav -> /etc/passwd`) with a valid extension, leading to Local File Inclusion (LFI) via `distribution:stage-release` or `distribution:transmit`.
**Learning:** Checking paths purely as strings (`path.normalize`) is insufficient for security when the underlying file system supports symlinks. An attacker can mask the true target of a path.
**Prevention:** Always use `fs.realpathSync` (or async equivalent) to resolve the canonical path *before* applying blocklists or allowlists (extensions, directories). This ensures validation is performed on the actual file being accessed.

## 2025-02-18 - [HIGH] Unsecured Electron IPC Handlers (SSRF & Arbitrary File Write)
**Vulnerability:** The `video:save-asset` IPC handler accepted arbitrary URLs and filenames without validation or sender verification. This allowed a compromised renderer (via XSS) to trigger SSRF (accessing internal/local network resources via `downloadFile`) and write files to the user's disk. The `video:open-folder` handler also lacked sender verification and path containment, potentially exposing file system structure.
**Learning:** Electron IPC handlers operate with high privileges (Node.js). Relying solely on the frontend to send "correct" data is a security flaw. Every IPC handler must be treated as an untrusted public API endpoint.
**Prevention:**
1. Always call `validateSender(event)` as the first line in every IPC handler.
2. Validate ALL inputs using strict schemas (e.g., Zod), especially URLs (SSRF protection) and file paths/names.
3. For file writes, explicitly strip directory components (`path.basename`) and sanitize filenames before usage, even if `path.join` is used.
## 2025-02-18 - [HIGH] Sensitive Data Exposure in PythonBridge Logs
**Vulnerability:** The `PythonBridge` utility logged all command-line arguments to the console for debugging. While it attempted to redact sensitive flags (like `--password`), it failed to redact sensitive positional arguments, specifically JSON strings containing PII (e.g., tax data, SSNs) passed to scripts like `tax_withholding_engine.py`.
**Learning:** heuristic-based redaction (checking for `--flag`) is insufficient when sensitive data is passed as positional arguments or complex JSON blobs. Logging command arguments in production is inherently risky.
**Prevention:** Implement explicit redaction capabilities where the caller defines which arguments are sensitive by index (`sensitiveArgsIndices`). Favor passing sensitive data via environment variables or stdin over command-line arguments where possible.

## 2026-01-22 - [HIGH] Path Traversal in Distribution ITMSP Packaging
**Vulnerability:** The `distribution:package-itmsp` IPC handler accepted an arbitrary `releaseId` string and used it directly in `path.join` to construct a staging directory path. This allowed an attacker to supply a malicious ID (e.g., `../../etc`) to escape the staging directory and direct the underlying Python script to operate on sensitive system directories (Arbitrary File Write/Read).
**Learning:** Inconsistent validation across handlers. While `distribution:stage-release` used a Zod schema to validate `releaseId`, `distribution:package-itmsp` did not. Every IPC handler must independently validate all its inputs.
**Prevention:** Enforced `z.string().uuid()` validation for `releaseId` in the `distribution:package-itmsp` handler, ensuring it is a valid UUID and contains no path traversal characters.

## 2026-01-23 - [HIGH] Permissive File Protocol in IPC Sender Validation
**Vulnerability:** The `validateSender` function checked if `url.startsWith('file://')` but did not verify that the file path belonged to the application bundle. This meant any local HTML file opened in the Electron window (e.g., via drag-and-drop or misconfiguration) could bypass the check and invoke privileged IPC handlers.
**Learning:** `file://` protocol is not inherently safe. Trusting the protocol without validating the path origin breaks the trust boundary between the application and the host file system.
**Prevention:** Hardened `validateSender` to resolve `file://` URLs using `fileURLToPath` and explicitly verify they reside within `app.getAppPath()` using `path.relative` checks.
## 2025-05-18 - [HIGH] SSRF in Video Asset Download (DNS Rebinding)
**Vulnerability:** The `video:save-asset` IPC handler relied solely on `FetchUrlSchema` (regex) to validate URLs. This schema blocks private IPs but cannot detect domains that resolve to private IPs (DNS Rebinding or local domains like `localhost.me`). This allowed potential SSRF attacks where the renderer could force the main process to access internal network resources.
**Learning:** Regex-based URL validation is insufficient for SSRF protection because it ignores DNS resolution.
**Prevention:**
1. Always use `validateSafeUrlAsync(url)` (or equivalent DNS-resolving validator) *before* making network requests in privileged contexts (Electron Main process).
2. Explicitly disable HTTP redirects (`fetch(url, { redirect: 'error' })`) when downloading untrusted content to prevent Open Redirect bypasses.

## 2026-02-18 - [HIGH] Permissive Content Security Policy (Data Exfiltration)
**Vulnerability:** The `Content-Security-Policy` header in `electron/security/index.ts` allowed `connect-src *` (via `ws: http: https:` wildcards) even in production. This permitted a compromised renderer (via XSS) to bypass the Main process network validation (`validateSafeUrlAsync`) and exfiltrate data to arbitrary external servers or establish WebSocket connections to attacker-controlled infrastructure.
**Learning:** CSP `connect-src` must be strictly whitelisted in production to serve as an effective Defense-in-Depth layer. Relying on Main process validation is insufficient if the renderer can communicate directly with the outside world.
**Prevention:**
1. Enforced strict domain whitelisting for `connect-src` in production (Google, Firebase, Essentia).
2. Removed generic `http:`, `https:`, and `ws:` protocols from the allowlist.
3. Added `media-src` directive (previously missing) to strictly control media playback sources.
4. Removed dead/insecure code (`SecureStore.ts`) to reduce attack surface.
