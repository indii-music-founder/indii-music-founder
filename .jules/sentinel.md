## 2026-01-19 - Credential Leak in Python Bridge
**Vulnerability:** Passwords and private keys for SFTP/Aspera transmission were passed as command-line arguments to Python scripts.
**Learning:** Command-line arguments are visible to all users on the system via the process table (`ps aux`). This is a classic CWE-200 / CWE-214 vulnerability.
**Prevention:** Always pass sensitive secrets via environment variables or standard input (stdin). Modified `PythonBridge` to support `env` injection and updated distribution handlers to use it.
