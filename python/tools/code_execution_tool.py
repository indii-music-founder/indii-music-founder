"""
Code Execution Tool — Computer-as-a-Tool for indiiOS

Sandboxed Python script execution via subprocess. Accepts code as a string,
runs it with timeout and memory limits, and returns stdout/stderr/exit_code.

Called by the TypeScript CodeExecutionTools via HTTP POST to /api/execute-code.
"""

import subprocess
import time
import sys
import os
import tempfile
import json
from typing import Any

# Try to import resource for memory limits (Unix-only)
try:
    import resource
    HAS_RESOURCE = True
except ImportError:
    HAS_RESOURCE = False


def execute_code(
    code: str,
    language: str = "python",
    timeout: int = 30,
    memory_limit_mb: int = 256,
) -> dict[str, Any]:
    """
    Execute a Python script in a sandboxed subprocess.

    Args:
        code: The Python code to execute.
        language: Programming language (only 'python' supported).
        timeout: Maximum execution time in seconds.
        memory_limit_mb: Maximum memory in MB (Unix only).

    Returns:
        dict with success, stdout, stderr, exit_code, execution_time.
    """
    if language != "python":
        return {
            "success": False,
            "stdout": "",
            "stderr": f"Language '{language}' is not supported. Only 'python' is available.",
            "exit_code": -1,
            "execution_time": 0,
        }

    if not code or not code.strip():
        return {
            "success": False,
            "stdout": "",
            "stderr": "No code provided.",
            "exit_code": -1,
            "execution_time": 0,
        }

    # Write code to a temporary file
    tmp_file = None
    try:
        tmp_file = tempfile.NamedTemporaryFile(
            mode="w",
            suffix=".py",
            prefix="indiios_exec_",
            delete=False,
        )
        tmp_file.write(code)
        tmp_file.flush()
        tmp_file.close()

        # Build the subprocess command
        python_exe = sys.executable

        # Restrict environment for security — use an explicit allowlist
        allowed_env_keys = {
            "PATH",
            "HOME",
            "TMPDIR",
            "LANG",
            "LC_ALL",
            "LC_CTYPE",
            "PYTHONPATH",
            "PYTHONIOENCODING",
            "PYENV_VERSION",
            "PYENV_ROOT",
        }
        env = {k: v for k, v in os.environ.items() if k in allowed_env_keys}

        # Set memory limit via preexec_fn (Unix only)
        preexec = None
        if HAS_RESOURCE and memory_limit_mb > 0:
            limit_bytes = memory_limit_mb * 1024 * 1024

            def _set_limits() -> None:
                resource.setrlimit(resource.RLIMIT_AS, (limit_bytes, limit_bytes))

            preexec = _set_limits

        start_time = time.monotonic()

        result = subprocess.run(
            [python_exe, tmp_file.name],
            capture_output=True,
            text=True,
            timeout=timeout,
            env=env,
            cwd=tempfile.gettempdir(),
            preexec_fn=preexec,
        )

        execution_time = int((time.monotonic() - start_time) * 1000)  # ms

        return {
            "success": result.returncode == 0,
            "stdout": result.stdout[:10000],  # Cap output at 10KB
            "stderr": result.stderr[:5000],   # Cap error at 5KB
            "exit_code": result.returncode,
            "execution_time": execution_time,
        }

    except subprocess.TimeoutExpired:
        execution_time = int(timeout * 1000)
        return {
            "success": False,
            "stdout": "",
            "stderr": f"Execution timed out after {timeout} seconds.",
            "exit_code": -1,
            "execution_time": execution_time,
        }
    except MemoryError:
        return {
            "success": False,
            "stdout": "",
            "stderr": f"Memory limit exceeded ({memory_limit_mb}MB).",
            "exit_code": -1,
            "execution_time": 0,
        }
    except Exception as e:
        return {
            "success": False,
            "stdout": "",
            "stderr": f"Execution error: {str(e)}",
            "exit_code": -1,
            "execution_time": 0,
        }
    finally:
        # Clean up the temp file
        if tmp_file and os.path.exists(tmp_file.name):
            try:
                os.unlink(tmp_file.name)
            except OSError:
                pass


# Flask/FastAPI endpoint handler (called from main API router)
def handle_execute_code(request_data: dict[str, Any]) -> dict[str, Any]:
    """HTTP handler for the /api/execute-code endpoint."""
    return execute_code(
        code=request_data.get("code", ""),
        language=request_data.get("language", "python"),
        timeout=min(request_data.get("timeout", 30), 60),  # Max 60s
        memory_limit_mb=min(request_data.get("memory_limit_mb", 256), 512),  # Max 512MB
    )


if __name__ == "__main__":
    # CLI test mode
    test_code = 'print("Hello from indiiOS Code Execution!")\nimport sys\nprint(f"Python {sys.version}")'
    result = execute_code(test_code)
    print(json.dumps(result, indent=2))
