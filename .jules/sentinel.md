## 2026-03-01 - Secure IPC & Process Arguments **Vulnerability:** Credential Leakage in Process Table **Learning:** Arguments passed to `child_process.spawn` are visible to all users on the system via `ps` or Task Manager. Logging utilities often inadvertently print these arguments. **Prevention:** Transmit sensitive credentials (passwords, private keys) via Environment Variables, which are private to the process tree. Implemented `redactArgs` in `PythonBridge` to sanitize logs.
## 2026-01-19 - Credential Leak in Python Bridge
**Vulnerability:** Passwords and private keys for SFTP/Aspera transmission were passed as command-line arguments to Python scripts.
**Learning:** Command-line arguments are visible to all users on the system via the process table (`ps aux`). This is a classic CWE-200 / CWE-214 vulnerability.
**Prevention:** Always pass sensitive secrets via environment variables or standard input (stdin). Modified `PythonBridge` to support `env` injection and updated distribution handlers to use it.
# Sentinel's Journal

## 2025-02-14 - Redacting Secrets in Process Logs
**Vulnerability:** Information Disclosure - Sensitive arguments (passwords, keys) passed to Python scripts were being logged in plain text to the console/log files via `PythonBridge`.
**Learning:** Even when using secure transmission methods (SFTP), local logging of command-line arguments can expose credentials. Standard logging often captures `argv` blindly.
**Prevention:** Implemented a redaction layer in `PythonBridge.runScript` that identifies sensitive flags (e.g., `--password`, `--key`) and masks their values in the log output before execution. This ensures debug logs remain useful but safe.
