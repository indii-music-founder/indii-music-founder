import uuid
import os


_runtime_id = str(uuid.uuid4())[:8]


def get_runtime_id() -> str:
    """Get a unique ID for this runtime session."""
    return _runtime_id


def get_web_ui_port() -> int:
    """Get the port for the web UI (default 50080)."""
    return int(os.getenv("WEB_UI_PORT", "50080"))


def get_web_ui_host() -> str:
    """Get the host for the web UI (default localhost)."""
    return os.getenv("WEB_UI_HOST", "localhost")
