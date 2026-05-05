import os
from pathlib import Path


def get_abs_path(relative_path: str) -> str:
    """Convert relative path to absolute path from repo root."""
    repo_root = Path(__file__).parent.parent.parent
    return str(repo_root / relative_path)
