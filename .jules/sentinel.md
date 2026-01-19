# Sentinel's Journal

## 2025-02-14 - Redacting Secrets in Process Logs
**Vulnerability:** Information Disclosure - Sensitive arguments (passwords, keys) passed to Python scripts were being logged in plain text to the console/log files via `PythonBridge`.
**Learning:** Even when using secure transmission methods (SFTP), local logging of command-line arguments can expose credentials. Standard logging often captures `argv` blindly.
**Prevention:** Implemented a redaction layer in `PythonBridge.runScript` that identifies sensitive flags (e.g., `--password`, `--key`) and masks their values in the log output before execution. This ensures debug logs remain useful but safe.
