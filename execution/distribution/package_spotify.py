#!/usr/bin/env python3
"""
package_spotify.py - Spotify SFTP Delivery Package Builder

Creates the directory structure required by Spotify's ingestion pipeline:

    /inbox/
      └── {batch_id}/
          ├── {release_id}.xml      (DDEX Ingestion Protocol 4.3)
          ├── resources/
          │   ├── track_1.flac
          │   ├── track_2.flac
          │   └── cover.jpg
          └── manifest.xml           (batch manifest)

Requirements from Spotify's Content Provider Onboarding Guide:
- DDEX Ingestion Protocol 4.3 XML validated against official XSD
- All tracks must have valid ISRCs
- Cover art: minimum 3000x3000 JPEG
- Content must be delivered 5+ business days before street date
- Manifest file listing all releases in the batch
"""

import argparse
import datetime
import hashlib
import json
import logging
import os
import shutil
import sys
import uuid
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional
from xml.dom import minidom

# Ensure sibling modules are importable
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from ingestion_generator import DDEXGenerator
from xsd_validator import DDEXXSDValidator

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("package_spotify")


def calculate_md5(file_path: str) -> str:
    """Calculate MD5 checksum for a file."""
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()


def generate_manifest(
    batch_id: str,
    releases: List[Dict[str, Any]],
    manifest_namespace: str,
) -> str:
    """Generate Spotify batch manifest XML.

    The manifest lists all releases included in a single batch delivery.
    Spotify uses this to track batch completeness and ordering.
    """
    if not manifest_namespace.strip():
        raise ValueError(
            "DDEX_MANIFEST_NAMESPACE is required for the configured ERN choreography profile"
        )
    root = ET.Element("ManifestMessage")
    root.set("xmlns", manifest_namespace.strip())

    # Manifest Header
    header = ET.SubElement(root, "MessageHeader")
    ET.SubElement(header, "MessageId").text = f"MANIFEST-{batch_id}"
    ET.SubElement(header, "MessageCreatedDateTime").text = (
        datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    )

    # Sender (indii)
    sender = ET.SubElement(header, "MessageSender")
    sender_dpid = os.environ.get("DDEX_SENDER_DPID", "")
    if not sender_dpid.strip():
        raise ValueError(
            "DDEX_SENDER_DPID is required; a Spotify manifest cannot invent a sender identity"
        )
    ET.SubElement(sender, "PartyId").text = DDEXGenerator.canonicalize_dpid(
        sender_dpid,
        "DDEX_SENDER_DPID",
    )

    # Release List in this batch
    release_list = ET.SubElement(root, "ReleaseList")
    for rel in releases:
        release_ref = ET.SubElement(release_list, "Release")
        ET.SubElement(release_ref, "ReleaseId").text = rel.get("release_id", "")
        ET.SubElement(release_ref, "XMLFileName").text = rel.get("xml_filename", "")
        ET.SubElement(release_ref, "Action").text = rel.get("action", "Insert")

    # Pretty print
    xml_string = ET.tostring(root, encoding='unicode')
    dom = minidom.parseString(xml_string)
    pretty_xml = dom.toprettyxml(indent="  ")
    lines = [line for line in pretty_xml.split('\n') if line.strip()]
    return '\n'.join(lines)


def package_spotify(
    release_id: str,
    staging_path: str,
    output_path: Optional[str] = None,
    batch_id: Optional[str] = None
) -> Dict[str, Any]:
    """Create a Spotify-format delivery package from a staged release.

    Args:
        release_id: Unique identifier for the release.
        staging_path: Path to directory containing metadata.json and audio files.
        output_path: Where to create the package. Defaults to parent of staging_path.
        batch_id: Batch identifier. Auto-generated if not provided.

    Returns:
        Report dict with status, paths, and details.

    Expected staging directory structure:
        staging_path/
        ├── metadata.json          (release metadata with tracks array)
        ├── cover.jpg              (cover art, 3000x3000 minimum)
        ├── track_1.flac           (audio files referenced in metadata)
        └── track_2.flac
    """
    logger.info(f"Starting Spotify package for release {release_id} from {staging_path}")

    try:
        # ─── 1. Validate staging directory ─────────────────────────────────
        if not os.path.exists(staging_path):
            return {"status": "FAIL", "error": f"Staging path {staging_path} does not exist"}

        metadata_path = os.path.join(staging_path, "metadata.json")
        if not os.path.exists(metadata_path):
            return {"status": "FAIL", "error": "metadata.json not found in staging directory"}

        with open(metadata_path, 'r') as f:
            metadata = json.load(f)

        # ─── 2. Validate required fields ───────────────────────────────────
        tracks = metadata.get("tracks", [])
        if not tracks:
            return {"status": "FAIL", "error": "No tracks found in metadata"}

        # Check ISRCs
        missing_isrcs = [
            t.get("title", f"Track {i}")
            for i, t in enumerate(tracks, 1)
            if not t.get("isrc")
        ]
        if missing_isrcs:
            return {
                "status": "FAIL",
                "error": f"Missing ISRCs for tracks: {', '.join(missing_isrcs)}. "
                         "Spotify requires valid ISRCs for all tracks."
            }

        # Check UPC
        if not metadata.get("upc"):
            return {"status": "FAIL", "error": "UPC is required for Spotify delivery"}

        # ─── 3. Process assets and compute checksums ───────────────────────
        processed_tracks = []
        for i, track in enumerate(tracks, 1):
            filename = track.get("filename")
            if not filename:
                return {"status": "FAIL", "error": f"Track '{track.get('title', i)}' missing 'filename'"}

            file_path = os.path.join(staging_path, filename)
            if not os.path.exists(file_path):
                return {"status": "FAIL", "error": f"Audio file {filename} missing from staging"}

            track["file_hash"] = calculate_md5(file_path)
            processed_tracks.append(track)

        metadata["tracks"] = processed_tracks

        # Cover art processing
        cover_filename = metadata.get("cover_filename", "cover.jpg")
        cover_path = os.path.join(staging_path, cover_filename)
        if os.path.exists(cover_path):
            metadata["cover_hash"] = calculate_md5(cover_path)
            metadata["cover_filename"] = cover_filename
        else:
            # Try common variations
            for fallback in ["cover.jpeg", "cover.png", "artwork.jpg", "artwork.png"]:
                fallback_path = os.path.join(staging_path, fallback)
                if os.path.exists(fallback_path):
                    metadata["cover_hash"] = calculate_md5(fallback_path)
                    metadata["cover_filename"] = fallback
                    cover_filename = fallback
                    cover_path = fallback_path
                    break
            else:
                return {
                    "status": "FAIL",
                    "error": "Cover art file missing. Spotify requires cover art (JPEG, 3000x3000 minimum)."
                }

        # ─── 4. Generate DDEX Ingestion Protocol 4.3 XML ──────────────────────────────────
        generator = DDEXGenerator()
        xml_content = generator.generate_ern(metadata)

        validation = DDEXXSDValidator(require_xsd=True).validate_xml_string(xml_content)
        if not validation["valid"] or validation.get("mode") != "xsd":
            return {
                "status": "FAIL",
                "error": validation.get("summary", "DDEX ERN 4.3 XSD validation failed"),
                "validation": validation,
                "delivery_ready": False,
            }

        # The batch manifest belongs to the ERN choreography standard, not to
        # the NewReleaseMessage schema. Both its namespace and entry-point XSD
        # come from the licensed/bilateral delivery profile and must validate
        # before any package directory is created.
        manifest_namespace = os.environ.get("DDEX_MANIFEST_NAMESPACE", "").strip()
        manifest_xsd_path = os.environ.get("DDEX_MANIFEST_XSD_PATH", "").strip()
        if not manifest_namespace or not manifest_xsd_path:
            return {
                "status": "FAIL",
                "error": (
                    "DDEX_MANIFEST_NAMESPACE and DDEX_MANIFEST_XSD_PATH are required "
                    "for a delivery-ready batched SFTP package"
                ),
                "validation": validation,
                "delivery_ready": False,
            }

        batch_id = batch_id or f"BATCH-{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"
        xml_filename = f"{release_id}.xml"
        manifest_xml = generate_manifest(
            batch_id,
            [{
                "release_id": release_id,
                "xml_filename": xml_filename,
                "action": "Insert",
            }],
            manifest_namespace,
        )
        manifest_validation = DDEXXSDValidator(
            xsd_path=manifest_xsd_path,
            require_xsd=True,
        ).validate_xml_string(manifest_xml)
        if not manifest_validation["valid"] or manifest_validation.get("mode") != "xsd":
            return {
                "status": "FAIL",
                "error": manifest_validation.get(
                    "summary",
                    "DDEX choreography manifest XSD validation failed",
                ),
                "validation": {
                    "ern": validation,
                    "manifest": manifest_validation,
                },
                "delivery_ready": False,
            }

        # ─── 5. Build Spotify package directory structure ──────────────────
        base_output = output_path or os.path.dirname(staging_path)
        package_path = os.path.join(base_output, batch_id)

        if os.path.exists(package_path):
            shutil.rmtree(package_path)

        # Create directory structure
        resources_path = os.path.join(package_path, "resources")
        os.makedirs(resources_path)

        # Write ERN XML
        with open(os.path.join(package_path, xml_filename), 'w', encoding='utf-8') as f:
            f.write(xml_content)

        # Copy audio files to resources/
        for track in processed_tracks:
            filename = track.get("filename")
            if filename:
                src = os.path.join(staging_path, filename)
                dst = os.path.join(resources_path, filename)
                shutil.copy2(src, dst)

        # Copy cover art to resources/
        if os.path.exists(cover_path):
            shutil.copy2(cover_path, os.path.join(resources_path, cover_filename))

        # ─── 6. Generate and write manifest ────────────────────────────────
        with open(os.path.join(package_path, "manifest.xml"), 'w', encoding='utf-8') as f:
            f.write(manifest_xml)

        # ─── 7. Verify package completeness ────────────────────────────────
        package_files = []
        for root_dir, dirs, files in os.walk(package_path):
            for name in files:
                rel = os.path.relpath(os.path.join(root_dir, name), package_path)
                package_files.append(rel)

        logger.info(f"Spotify package created at {package_path}")
        logger.info(f"Package contents: {package_files}")

        return {
            "status": "PASS",
            "batch_id": batch_id,
            "release_id": release_id,
            "package_path": package_path,
            "xml_filename": xml_filename,
            "track_count": len(processed_tracks),
            "files": package_files,
            "details": f"Spotify delivery package ready with {len(processed_tracks)} tracks.",
            "delivery_ready": True,
            "validation": {
                "ern": validation,
                "manifest": manifest_validation,
            },
        }

    except Exception as e:
        logger.exception("Spotify packaging failed")
        return {"status": "FAIL", "error": str(e), "delivery_ready": False}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Spotify SFTP Delivery Package Builder")
    parser.add_argument("release_id", help="Unique release identifier")
    parser.add_argument("staging_path", help="Path to staged assets and metadata")
    parser.add_argument("--output", help="Output directory for the package")
    parser.add_argument("--batch-id", help="Optional batch identifier")

    args = parser.parse_args()

    result = package_spotify(
        release_id=args.release_id,
        staging_path=args.staging_path,
        output_path=args.output,
        batch_id=args.batch_id
    )
    print(json.dumps(result, indent=2))
