#!/usr/bin/env python3
"""
ddex_build.py - End-to-End Release Submission Orchestrator

Chains the full distribution pipeline in a single invocation:
  1. QC validate metadata
  2. Assign ISRC (if not provided)
  3. Generate DDEX ERN 4.3 XML
  4. SFTP upload to distributor endpoint

Emits JSON progress events to stdout so the Electron AgentSupervisor
can relay them to the renderer as real-time progress updates.

Usage:
  python ddex_build.py <release_json> [--storage-path PATH] [--dry-run]
"""

import argparse
import json
import logging
import os
import sys
import tempfile
from typing import Any, Dict

# ---------------------------------------------------------------------------
# Logging — structured JSON lines for machine-readable progress in Electron
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("ddex_build")

# Allow sibling imports
_DIR = os.path.dirname(os.path.abspath(__file__))
if _DIR not in sys.path:
    sys.path.insert(0, _DIR)

from qc_validator import QCValidator
from isrc_manager import IdentityManager
from ddex_generator import DDEXGenerator
from sftp_uploader import SFTPUploader


def emit(step: str, status: str, progress: int, detail: str = "", data: Any = None) -> None:
    """Print a structured progress line that AgentSupervisor parses."""
    payload: Dict[str, Any] = {
        "step": step,
        "status": status,   # "running" | "done" | "error"
        "progress": progress,
        "detail": detail,
    }
    if data is not None:
        payload["data"] = data
    print(json.dumps(payload), flush=True)


def run(release: Dict[str, Any], storage_path: str, dry_run: bool) -> Dict[str, Any]:
    """Execute the full pipeline and return a summary dict."""

    # -----------------------------------------------------------------------
    # STEP 1 — Metadata QC
    # -----------------------------------------------------------------------
    emit("qc", "running", 10, "Validating release metadata…")
    validator = QCValidator()
    qc_result = validator.validate_metadata(release)
    if not qc_result["valid"]:
        emit("qc", "error", 10, f"QC failed: {qc_result['errors']}", qc_result)
        return {
            "status": "FAIL",
            "stage": "qc",
            "errors": qc_result["errors"],
            "warnings": qc_result.get("warnings", []),
        }
    emit("qc", "done", 25, "Metadata passed QC", qc_result)

    # -----------------------------------------------------------------------
    # STEP 2 — ISRC Assignment
    # -----------------------------------------------------------------------
    emit("isrc", "running", 30, "Assigning ISRCs to tracks…")
    id_manager = IdentityManager(store_path=os.path.join(storage_path, "identity_store.json"))

    tracks = release.get("tracks", [])
    for i, track in enumerate(tracks):
        if not track.get("isrc"):
            isrc_data = id_manager.generate_isrc(
                track_title=track.get("title", f"Track {i + 1}"),
                artist_name=release.get("artist") or (release.get("artists") or ["Unknown"])[0],
            )
            track["isrc"] = isrc_data["isrc"]
            logger.info(f"Assigned ISRC {track['isrc']} to track '{track.get('title')}'")

    emit("isrc", "done", 45, f"ISRC assigned to {len(tracks)} track(s)", {"tracks": [t.get("isrc") for t in tracks]})

    # -----------------------------------------------------------------------
    # STEP 3 — DDEX XML Generation
    # -----------------------------------------------------------------------
    emit("ddex", "running", 50, "Generating DDEX ERN 4.3 XML…")
    generator = DDEXGenerator()

    # Normalise the release dict into the shape expected by DDEXGenerator
    ddex_metadata = {**release, "tracks": tracks}
    xml_string = generator.generate(ddex_metadata)

    xml_path = os.path.join(storage_path, f"ddex_{release.get('releaseId', 'release')}.xml")
    os.makedirs(storage_path, exist_ok=True)
    with open(xml_path, "w", encoding="utf-8") as f:
        f.write(xml_string)

    emit("ddex", "done", 70, f"DDEX XML written → {xml_path}", {"xml_path": xml_path})

    # -----------------------------------------------------------------------
    # STEP 4 — SFTP Upload (skipped in dry-run mode)
    # -----------------------------------------------------------------------
    sftp_config = release.get("sftpConfig")
    if dry_run or not sftp_config:
        reason = "dry-run mode" if dry_run else "no sftpConfig provided"
        emit("sftp", "done", 100, f"SFTP upload skipped ({reason})")
        return {
            "status": "SUCCESS",
            "xml_path": xml_path,
            "xml": xml_string,
            "tracks": tracks,
            "sftp_skipped": True,
            "sftp_skip_reason": reason,
        }

    emit("sftp", "running", 75, f"Uploading to {sftp_config.get('host')}…")
    uploader = SFTPUploader(storage_path=storage_path)

    # Credentials come in via env vars (SFTP_PASSWORD / SFTP_KEY_PATH) for security.
    sftp_result = uploader.upload(
        host=sftp_config["host"],
        port=int(sftp_config.get("port", 22)),
        username=sftp_config["user"],
        password=os.environ.get("SFTP_PASSWORD"),
        key_path=os.environ.get("SFTP_KEY_PATH"),
        local_path=xml_path,
        remote_path=sftp_config.get("remotePath", "/"),
    )

    if sftp_result.get("status") != "SUCCESS":
        emit("sftp", "error", 80, f"Upload failed: {sftp_result.get('error')}", sftp_result)
        return {
            "status": "FAIL",
            "stage": "sftp",
            "xml_path": xml_path,
            "sftp_error": sftp_result.get("error"),
        }

    emit("sftp", "done", 100, "Package delivered to distributor", sftp_result)
    return {
        "status": "SUCCESS",
        "xml_path": xml_path,
        "xml": xml_string,
        "tracks": tracks,
        "sftp": sftp_result,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="indiiOS DDEX Build Orchestrator")
    parser.add_argument("release_json", help="JSON string containing release metadata")
    parser.add_argument("--storage-path", default=os.path.join(tempfile.gettempdir(), "indiiOS-dist"),
                        help="Working directory for output files")
    parser.add_argument("--dry-run", action="store_true",
                        help="Run all steps but skip SFTP upload")
    args = parser.parse_args()

    try:
        release_data = json.loads(args.release_json)
        result = run(release_data, args.storage_path, args.dry_run)
        # Final JSON result on the last line — AgentSupervisor reads this
        print(json.dumps(result), flush=True)
        sys.exit(0 if result.get("status") == "SUCCESS" else 1)

    except json.JSONDecodeError as e:
        print(json.dumps({"status": "FAIL", "error": f"Invalid JSON: {e}"}), flush=True)
        sys.exit(1)
    except Exception as e:
        logger.exception("Unexpected error in ddex_build orchestrator")
        print(json.dumps({"status": "FAIL", "error": str(e)}), flush=True)
        sys.exit(1)
