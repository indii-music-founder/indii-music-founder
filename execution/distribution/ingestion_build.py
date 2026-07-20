#!/usr/bin/env python3
"""
ingestion_build.py - End-to-End Release Submission Orchestrator

Chains the full distribution pipeline in a single invocation:
  1. QC validate metadata
  2. Assign ISRC (if not provided)
  3. Generate DDEX Ingestion Protocol 4.3 XML
  4. SFTP upload to distributor endpoint

Emits JSON progress events to stdout so the Electron AgentSupervisor
can relay them to the renderer as real-time progress updates.

Usage:
  python ingestion_build.py <release_json> [--storage-path PATH] [--dry-run]
"""

import argparse
import hashlib
import json
import logging
import os
import re
import shutil
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
logger = logging.getLogger("ingestion_build")

# Allow sibling imports
_DIR = os.path.dirname(os.path.abspath(__file__))
if _DIR not in sys.path:
    sys.path.insert(0, _DIR)

from qc_validator import QCValidator  # noqa: E402
from isrc_manager import IdentityManager  # noqa: E402
from ingestion_generator import DDEXGenerator  # noqa: E402
from sftp_uploader import SFTPUploader  # noqa: E402
from xsd_validator import DDEXXSDValidator  # noqa: E402


def _file_digest(file_path: str, algorithm: str) -> str:
    """Hash a staged master without loading a potentially multi-GB file into memory."""
    if algorithm == "md5":
        digest = hashlib.md5(usedforsecurity=False)
    else:
        digest = hashlib.new(algorithm)
    with open(file_path, "rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _safe_resource_name(index: int, original_file_name: str) -> str:
    base_name = os.path.basename(original_file_name)
    stem, extension = os.path.splitext(base_name)
    safe_stem = re.sub(r"[^A-Za-z0-9._-]+", "-", stem).strip(".-") or "master"
    safe_extension = extension.lower() if re.fullmatch(r"\.[A-Za-z0-9]{1,8}", extension) else ".audio"
    return f"{index:02d}-{safe_stem}{safe_extension}"


def _stage_master_resources(tracks: list[Dict[str, Any]], package_path: str) -> None:
    """Copy verified canonical masters into the immutable delivery package."""
    resources_path = os.path.join(package_path, "resources")
    os.makedirs(resources_path, exist_ok=True)

    for index, track in enumerate(tracks, 1):
        master_asset = track.get("master_asset")
        if not isinstance(master_asset, dict):
            raise ValueError(f"Track {index} is missing its canonical master_asset")

        local_path = master_asset.get("local_path")
        expected_sha256 = str(master_asset.get("content_hash", "")).lower()
        expected_size = master_asset.get("size_bytes")
        if not isinstance(local_path, str) or not os.path.isfile(local_path) or os.path.islink(local_path):
            raise ValueError(f"Track {index} canonical master is not a regular local file")
        if not re.fullmatch(r"[a-f0-9]{64}", expected_sha256):
            raise ValueError(f"Track {index} canonical master has an invalid SHA-256 digest")
        if not isinstance(expected_size, int) or os.path.getsize(local_path) != expected_size:
            raise ValueError(f"Track {index} canonical master size verification failed")
        if _file_digest(local_path, "sha256") != expected_sha256:
            raise ValueError(f"Track {index} canonical master SHA-256 verification failed")

        resource_name = _safe_resource_name(
            index,
            str(master_asset.get("original_file_name") or track.get("filename") or "master.audio"),
        )
        destination = os.path.join(resources_path, resource_name)
        shutil.copyfile(local_path, destination)

        # DDEX's HashSumAlgorithmType below is MD5, so derive that digest from
        # the verified bytes rather than mislabeling the SHA-256 content address.
        track["filename"] = f"resources/{resource_name}"
        track["file_hash"] = _file_digest(destination, "md5")


def _stage_cover_resource(release: Dict[str, Any], package_path: str) -> None:
    """Copy a desktop-verified canonical cover into the delivery package."""
    cover_asset = release.get("cover_asset")
    if not isinstance(cover_asset, dict):
        raise ValueError("Release is missing its canonical cover_asset")
    local_path = cover_asset.get("local_path")
    expected_sha256 = str(cover_asset.get("content_hash", "")).lower()
    expected_size = cover_asset.get("size_bytes")
    mime_type = cover_asset.get("mime_type")
    width = cover_asset.get("width")
    height = cover_asset.get("height")
    color_space = cover_asset.get("color_space")
    if not isinstance(local_path, str) or not os.path.isfile(local_path) or os.path.islink(local_path):
        raise ValueError("Canonical cover is not a regular local file")
    if not re.fullmatch(r"[a-f0-9]{64}", expected_sha256):
        raise ValueError("Canonical cover has an invalid SHA-256 digest")
    if not isinstance(expected_size, int) or os.path.getsize(local_path) != expected_size:
        raise ValueError("Canonical cover size verification failed")
    if _file_digest(local_path, "sha256") != expected_sha256:
        raise ValueError("Canonical cover SHA-256 verification failed")
    if mime_type not in {"image/jpeg", "image/png"} or not isinstance(width, int) or not isinstance(height, int) or width < 3000 or height < 3000 or width != height or color_space != "rgb":
        raise ValueError("Canonical cover must be measured square RGB JPEG/PNG at least 3000px")
    extension = ".png" if mime_type == "image/png" else ".jpg"
    destination = os.path.join(package_path, "resources", f"cover-{expected_sha256[:16]}{extension}")
    shutil.copyfile(local_path, destination)
    release["cover_filename"] = f"resources/{os.path.basename(destination)}"
    release["cover_hash"] = _file_digest(destination, "md5")
    release["cover_width"] = width
    release["cover_height"] = height


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
            # isrc_manager.py: generate_isrc(country=None, registrant=None) -> str
            isrc = id_manager.generate_isrc()
            track["isrc"] = isrc
            logger.info(f"Assigned ISRC {track['isrc']} to track '{track.get('title')}'")

    emit("isrc", "done", 45, f"ISRC assigned to {len(tracks)} track(s)", {"tracks": [t.get("isrc") for t in tracks]})

    # -----------------------------------------------------------------------
    # STEP 3 — Package canonical master resources and generate DDEX XML
    # -----------------------------------------------------------------------
    emit("ingestion", "running", 50, "Generating DDEX Ingestion Protocol 4.3 XML…")
    generator = DDEXGenerator()

    safe_release_id = re.sub(r"[^A-Za-z0-9._-]+", "-", str(release.get("releaseId", "release"))).strip(".-")
    if not safe_release_id:
        raise ValueError("Release ID cannot be converted into a safe package name")
    package_path = os.path.join(storage_path, "packages", safe_release_id)
    shutil.rmtree(package_path, ignore_errors=True)
    os.makedirs(package_path, exist_ok=True)
    try:
        _stage_master_resources(tracks, package_path)
        _stage_cover_resource(release, package_path)
    except (OSError, ValueError) as error:
        shutil.rmtree(package_path, ignore_errors=True)
        emit("ingestion", "error", 50, f"Canonical delivery-asset staging failed: {error}")
        return {
            "status": "FAIL",
            "stage": "master_staging",
            "errors": [str(error)],
            "delivery_ready": False,
        }

    # Normalise the release dict into the shape expected by DDEXGenerator
    # Ensure mandatory cover fields are present if using artwork_url
    if "artwork_url" in release and "cover_filename" not in release:
        release["cover_filename"] = "cover.jpg"
    
    # If a UPC was assigned during Identity management, ensure it's in metadata
    ingestion_metadata = {**release, "tracks": tracks}
    if not ingestion_metadata.get("upc"):
        ingestion_metadata["upc"] = id_manager.generate_upc()

    xml_string = generator.generate_ern(ingestion_metadata)

    # A draft/dry-run may use the structural validator for local feedback, but
    # an actual partner upload must prove conformance against the configured
    # licensed ERN 4.3 XSD. No SFTP mutation happens before this gate passes.
    sftp_config: Dict[str, Any] = release.get("sftpConfig") or {}
    require_xsd = bool(sftp_config) and not dry_run
    validation = DDEXXSDValidator(require_xsd=require_xsd).validate_xml_string(xml_string)
    if not validation["valid"] or (require_xsd and validation.get("mode") != "xsd"):
        emit(
            "ingestion",
            "error",
            65,
            f"DDEX validation failed: {validation.get('summary', 'unknown validation error')}",
            validation,
        )
        return {
            "status": "FAIL",
            "stage": "ddex_validation",
            "validation": validation,
            "errors": validation.get("errors", []),
        }

    xml_path = os.path.join(package_path, f"{safe_release_id}.xml")
    with open(xml_path, "w", encoding="utf-8") as f:
        f.write(xml_string)

    emit("ingestion", "done", 70, f"DDEX XML written → {xml_path}", {"xml_path": xml_path})

    # -----------------------------------------------------------------------
    # STEP 4 — SFTP Upload (skipped in dry-run mode)
    # -----------------------------------------------------------------------
    if dry_run or not sftp_config:
        reason = "dry-run mode" if dry_run else "no sftpConfig provided"
        emit("sftp", "done", 100, f"SFTP upload skipped ({reason})")
        return {
            "status": "SUCCESS",
            "xml_path": xml_path,
            "package_path": package_path,
            "xml": xml_string,
            "tracks": tracks,
            "sftp_skipped": True,
            "sftp_skip_reason": reason,
            "validation": validation,
            "xsd_validated": validation.get("mode") == "xsd",
            "delivery_ready": False,
        }

    host = str(sftp_config.get("host", "unknown"))
    emit("sftp", "running", 75, f"Uploading to {host}…")
    uploader = SFTPUploader(storage_path=storage_path)

    # Credentials come in via env vars (SFTP_PASSWORD / SFTP_KEY_PATH) for security.
    sftp_result = uploader.upload(
        host=host,
        port=int(sftp_config.get("port", 22)),
        username=str(sftp_config.get("user", "")),
        password=os.environ.get("SFTP_PASSWORD"),
        key_path=os.environ.get("SFTP_KEY_PATH"),
        local_path=package_path,
        remote_path=str(sftp_config.get("remotePath", "/")),
    )

    if sftp_result.get("status") != "SUCCESS":
        emit("sftp", "error", 80, f"Upload failed: {sftp_result.get('error')}", sftp_result)
        return {
            "status": "FAIL",
            "stage": "sftp",
            "xml_path": xml_path,
            "package_path": package_path,
            "sftp_error": sftp_result.get("error"),
        }

    emit("sftp", "done", 100, "Package delivered to distributor", sftp_result)
    return {
        "status": "SUCCESS",
        "xml_path": xml_path,
        "package_path": package_path,
        "xml": xml_string,
        "tracks": tracks,
        "sftp": sftp_result,
        "validation": validation,
        "xsd_validated": True,
        "delivery_ready": True,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="indii DDEX Build Orchestrator")
    parser.add_argument("release_json", help="JSON string containing release metadata")
    parser.add_argument("--storage-path", default=os.path.join(tempfile.gettempdir(), "indii-dist"),
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
        logger.exception("Unexpected error in ingestion_build orchestrator")
        print(json.dumps({"status": "FAIL", "error": str(e)}), flush=True)
        sys.exit(1)
