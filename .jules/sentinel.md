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
