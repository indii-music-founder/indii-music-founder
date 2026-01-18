import logging
import os
import sys
from typing import List

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("conflict_resolver")


def scan_for_merge_conflicts(search_path: str = ".") -> List[str]:
    """Scans the codebase for git merge conflict markers.

    Conflict markers checked: '<<<<<<<', '=======', '>>>>>>>'.

    Args:
        search_path: The directory to start the scan from.

    Returns:
        A list of file paths containing unresolved merge conflicts.
    """
    logger.info(
        f"Scanning for merge conflicts in: {os.path.abspath(search_path)}"
    )
    conflicts: List[str] = []

    # Directories to skip for performance and relevance
    ignore_dirs = {
        "node_modules",
        ".git",
        "dist",
        "build",
        ".venv",
        "__pycache__"}

    for root, dirs, files in os.walk(search_path):
        # Prune ignored directories in-place
        dirs[:] = [d for d in dirs if d not in ignore_dirs]

        for file in files:
            file_path = os.path.join(root, file)

            # Skip large binary files if possible (optional safeguard)
            if file.endswith((".png", ".jpg", ".pdf", ".zip", ".exe", ".bin")):
                continue

            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    # Read lines to avoid loading massive files entirely if possible,
                    # but for conflict checking, a full read is often safer.
                    content = f.read()
                    if "<<<<<<<" in content and ">>>>>>>" in content:
                        conflicts.append(file_path)
                        logger.warning(f"Conflict detected: {file_path}")
            except (OSError, UnicodeDecodeError):
                # Ignore files that cannot be read as text
                continue

    return conflicts


if __name__ == "__main__":
    found_conflicts = scan_for_merge_conflicts()

    if found_conflicts:
        # Use sys.stderr for errors
        sys.stderr.write(
            f"\nCRITICAL: Found unresolved merge conflicts in "
            f"{len(found_conflicts)} files:\n"
        )
        for conflict_path in found_conflicts:
            sys.stderr.write(f"  [!] {conflict_path}\n")
        sys.exit(1)
    else:
        logger.info("RESULT: Clean scan. No merge conflicts detected.")
        sys.exit(0)
