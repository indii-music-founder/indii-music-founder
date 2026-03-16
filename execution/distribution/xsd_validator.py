#!/usr/bin/env python3
"""
xsd_validator.py - DDEX ERN 4.3 XSD Schema Validator

Validates DDEX ERN XML against the official XSD schema.
Spotify REQUIRES XSD validation before delivery.

XSD files must be downloaded from the DDEX Knowledge Base:
  https://kb.ddex.net/display/ERNDG/ERN+4

Place the XSD files in the 'schemas/' subdirectory relative to this script,
or set the DDEX_XSD_PATH environment variable.

If the official XSD is not available, falls back to structural validation
that checks for required elements, attribute patterns, and value constraints.
"""

import argparse
import json
import logging
import os
import re
import sys
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("xsd_validator")

# Try to import lxml for XSD validation (optional but preferred)
try:
    from lxml import etree as lxml_etree
    HAS_LXML = True
except ImportError:
    HAS_LXML = False
    logger.info("lxml not available — using structural validation fallback")


class DDEXXSDValidator:
    """Validates DDEX ERN 4.3 XML against official XSD or structural rules.

    Two validation modes:
    1. Full XSD validation (requires lxml + official XSD files)
    2. Structural validation (fallback, checks required elements and patterns)
    """

    # DDEX ERN 4.3 Namespace
    ERN_NS = "http://ddex.net/xml/ern/43"

    # Required elements for a valid NewReleaseMessage
    REQUIRED_ELEMENTS = [
        "MessageHeader",
        "MessageHeader/MessageThreadId",
        "MessageHeader/MessageId",
        "MessageHeader/MessageSender",
        "MessageHeader/MessageSender/PartyId",
        "MessageHeader/MessageRecipient",
        "MessageHeader/MessageRecipient/PartyId",
        "MessageHeader/MessageCreatedDateTime",
        "ResourceList",
        "ReleaseList",
        "ReleaseList/Release",
        "ReleaseList/Release/ReleaseId",
        "ReleaseList/Release/ReleaseReference",
        "ReleaseList/Release/ReleaseType",
        "DealList",
    ]

    # Required elements for each SoundRecording
    SOUND_RECORDING_REQUIRED = [
        "SoundRecordingType",
        "ResourceReference",
        "Duration",
        "SoundRecordingDetailsByTerritory",
        "SoundRecordingDetailsByTerritory/TerritoryCode",
    ]

    # ISRC pattern: CC-XXX-YY-NNNNN
    ISRC_PATTERN = re.compile(r'^[A-Z]{2}-?[A-Z0-9]{3}-?\d{2}-?\d{5}$')

    # UPC/EAN pattern: 12-13 digits
    UPC_PATTERN = re.compile(r'^\d{12,13}$')

    # ISO 8601 Duration pattern: PT(n)M(n)S
    DURATION_PATTERN = re.compile(r'^PT(\d+H)?(\d+M)?(\d+S)?$')

    # ISO 8601 DateTime pattern
    DATETIME_PATTERN = re.compile(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z?$')

    # Date pattern: YYYY-MM-DD
    DATE_PATTERN = re.compile(r'^\d{4}-\d{2}-\d{2}$')

    def __init__(self, xsd_path: Optional[str] = None):
        """Initialize the validator.

        Args:
            xsd_path: Path to DDEX ERN 4.3 XSD schema file.
                      Defaults to DDEX_XSD_PATH env var or schemas/ern-main.xsd
        """
        self.xsd_path = xsd_path or os.environ.get(
            "DDEX_XSD_PATH",
            os.path.join(os.path.dirname(__file__), "schemas", "ern-main.xsd")
        )
        self.xsd_schema = None

        # Try to load XSD if lxml is available
        if HAS_LXML and os.path.exists(self.xsd_path):
            try:
                schema_doc = lxml_etree.parse(self.xsd_path)
                self.xsd_schema = lxml_etree.XMLSchema(schema_doc)
                logger.info(f"Loaded XSD schema from {self.xsd_path}")
            except Exception as e:
                logger.warning(f"Failed to load XSD schema: {e}. Using structural validation.")

    def validate_xml_string(self, xml_string: str) -> Dict[str, Any]:
        """Validate a DDEX ERN XML string.

        Args:
            xml_string: The XML content to validate.

        Returns:
            Validation report with errors, warnings, and overall status.
        """
        errors: List[str] = []
        warnings: List[str] = []

        # ─── Mode 1: Full XSD Validation (if schema loaded) ──────────────
        if self.xsd_schema and HAS_LXML:
            try:
                doc = lxml_etree.fromstring(xml_string.encode('utf-8'))
                is_valid = self.xsd_schema.validate(doc)

                if not is_valid:
                    for error in self.xsd_schema.error_log:
                        errors.append(f"XSD[{error.line}:{error.column}]: {error.message}")

                return {
                    "valid": is_valid,
                    "mode": "xsd",
                    "errors": errors,
                    "warnings": warnings,
                    "summary": "XSD validation passed" if is_valid else f"XSD validation failed with {len(errors)} errors"
                }
            except lxml_etree.XMLSyntaxError as e:
                return {
                    "valid": False,
                    "mode": "xsd",
                    "errors": [f"XML syntax error: {str(e)}"],
                    "warnings": [],
                    "summary": "XML is not well-formed"
                }

        # ─── Mode 2: Structural Validation (fallback) ────────────────────
        return self._validate_structural(xml_string, errors, warnings)

    def validate_file(self, file_path: str) -> Dict[str, Any]:
        """Validate a DDEX ERN XML file.

        Args:
            file_path: Path to the XML file.

        Returns:
            Validation report.
        """
        if not os.path.exists(file_path):
            return {
                "valid": False,
                "mode": "none",
                "errors": [f"File not found: {file_path}"],
                "warnings": [],
                "summary": "File does not exist"
            }

        with open(file_path, 'r', encoding='utf-8') as f:
            xml_string = f.read()

        result = self.validate_xml_string(xml_string)
        result["file"] = file_path
        return result

    def _validate_structural(self, xml_string: str,
                              errors: List[str],
                              warnings: List[str]) -> Dict[str, Any]:
        """Perform structural validation against DDEX ERN 4.3 rules.

        This is the fallback when lxml/XSD is not available.
        It checks required elements, value patterns, and business rules.
        """
        logger.info("Performing structural validation (XSD not available)")

        # Parse XML
        try:
            root = ET.fromstring(xml_string)
        except ET.ParseError as e:
            return {
                "valid": False,
                "mode": "structural",
                "errors": [f"XML parse error: {str(e)}"],
                "warnings": [],
                "summary": "XML is not well-formed"
            }

        # Strip namespace for easier traversal
        ns = ""
        root_tag = root.tag
        if root_tag.startswith("{"):
            ns = root_tag.split("}")[0] + "}"
            # Verify it's the DDEX namespace
            actual_ns = root_tag.split("}")[0].lstrip("{")
            if "ddex.net" not in actual_ns:
                errors.append(f"Unexpected namespace: {actual_ns}. Expected DDEX ERN namespace.")

        # Check root element
        local_tag = root_tag.replace(ns, "")
        if local_tag != "NewReleaseMessage":
            errors.append(f"Root element must be 'NewReleaseMessage', got '{local_tag}'")

        # Check required attributes on root
        profile = root.get("ReleaseProfileVersionId", "")
        if not profile:
            errors.append("Missing ReleaseProfileVersionId attribute on root element")
        elif "CommonReleaseTypes" not in profile:
            warnings.append(f"Unusual ReleaseProfileVersionId: {profile}")

        lang = root.get("LanguageAndScriptCode", "")
        if not lang:
            warnings.append("Missing LanguageAndScriptCode attribute on root element")

        # Check required elements
        for path in self.REQUIRED_ELEMENTS:
            # Convert path to namespaced version
            ns_path = "/".join(f"{ns}{p}" for p in path.split("/"))
            elem = root.find(ns_path)
            if elem is None:
                errors.append(f"Missing required element: {path}")

        # Validate MessageHeader fields
        self._validate_header(root, ns, errors, warnings)

        # Validate ResourceList
        self._validate_resources(root, ns, errors, warnings)

        # Validate ReleaseList
        self._validate_releases(root, ns, errors, warnings)

        # Validate DealList
        self._validate_deals(root, ns, errors, warnings)

        is_valid = len(errors) == 0
        return {
            "valid": is_valid,
            "mode": "structural",
            "errors": errors,
            "warnings": warnings,
            "summary": (
                "Structural validation passed"
                if is_valid
                else f"Structural validation failed with {len(errors)} errors"
            )
        }

    def _validate_header(self, root: ET.Element, ns: str,
                          errors: List[str], warnings: List[str]) -> None:
        """Validate MessageHeader content."""
        header = root.find(f"{ns}MessageHeader")
        if header is None:
            return

        # MessageCreatedDateTime format
        dt_elem = header.find(f"{ns}MessageCreatedDateTime")
        if dt_elem is not None and dt_elem.text:
            if not self.DATETIME_PATTERN.match(dt_elem.text):
                errors.append(
                    f"MessageCreatedDateTime '{dt_elem.text}' is not valid ISO 8601. "
                    "Expected format: YYYY-MM-DDTHH:MM:SSZ"
                )

        # Sender PartyId must not be placeholder
        sender = header.find(f"{ns}MessageSender")
        if sender is not None:
            party_id = sender.findtext(f"{ns}PartyId", "")
            if party_id.startswith("PADPIDA0000"):
                warnings.append(
                    f"Sender PartyId '{party_id}' appears to be a placeholder. "
                    "Register at https://dpid.ddex.net/ for a production DPID."
                )

    def _validate_resources(self, root: ET.Element, ns: str,
                             errors: List[str], warnings: List[str]) -> None:
        """Validate ResourceList content."""
        resource_list = root.find(f"{ns}ResourceList")
        if resource_list is None:
            return

        # Check for SoundRecordings
        sound_recordings = resource_list.findall(f"{ns}SoundRecording")
        if not sound_recordings:
            errors.append("ResourceList must contain at least one SoundRecording")

        for i, sr in enumerate(sound_recordings, 1):
            # Check required sub-elements
            for path in self.SOUND_RECORDING_REQUIRED:
                ns_path = "/".join(f"{ns}{p}" for p in path.split("/"))
                if sr.find(ns_path) is None:
                    errors.append(f"SoundRecording[{i}] missing required element: {path}")

            # Validate ISRC
            sr_id = sr.find(f"{ns}SoundRecordingId")
            if sr_id is not None:
                isrc = sr_id.findtext(f"{ns}ISRC", "")
                if isrc and not self.ISRC_PATTERN.match(isrc):
                    errors.append(
                        f"SoundRecording[{i}] ISRC '{isrc}' does not match format CC-XXX-YY-NNNNN"
                    )
            else:
                warnings.append(f"SoundRecording[{i}] has no SoundRecordingId/ISRC")

            # Validate Duration format
            duration = sr.findtext(f"{ns}Duration", "")
            if duration and not self.DURATION_PATTERN.match(duration):
                errors.append(
                    f"SoundRecording[{i}] Duration '{duration}' is not valid ISO 8601 duration"
                )

        # Check for Image resource (cover art)
        images = resource_list.findall(f"{ns}Image")
        if not images:
            warnings.append(
                "No Image resource found in ResourceList. "
                "Cover art is required by most DSPs (Apple Music, Spotify)."
            )

    def _validate_releases(self, root: ET.Element, ns: str,
                            errors: List[str], warnings: List[str]) -> None:
        """Validate ReleaseList content."""
        release_list = root.find(f"{ns}ReleaseList")
        if release_list is None:
            return

        releases = release_list.findall(f"{ns}Release")
        if not releases:
            errors.append("ReleaseList must contain at least one Release")
            return

        for i, release in enumerate(releases, 1):
            # UPC/ICPN
            release_id = release.find(f"{ns}ReleaseId")
            if release_id is not None:
                icpn = release_id.findtext(f"{ns}ICPN", "")
                if icpn and not self.UPC_PATTERN.match(icpn):
                    errors.append(
                        f"Release[{i}] ICPN/UPC '{icpn}' must be 12-13 digits"
                    )
            else:
                errors.append(f"Release[{i}] missing ReleaseId")

            # ReleaseType
            release_type = release.findtext(f"{ns}ReleaseType", "")
            valid_types = [
                "Album", "Single", "EP", "Bundle", "VideoSingle",
                "Ringtone", "ClassicalAlbum", "MaxiSingle"
            ]
            if release_type and release_type not in valid_types:
                warnings.append(
                    f"Release[{i}] ReleaseType '{release_type}' may not be recognized by all DSPs"
                )

            # Release Date
            details = release.find(f"{ns}ReleaseDetailsByTerritory")
            if details is not None:
                release_date = details.findtext(f"{ns}OriginalReleaseDate", "")
                if release_date and not self.DATE_PATTERN.match(release_date):
                    errors.append(
                        f"Release[{i}] OriginalReleaseDate '{release_date}' must be YYYY-MM-DD"
                    )

            # Resource references
            rr_list = release.find(f"{ns}ReleaseResourceReferenceList")
            if rr_list is None:
                errors.append(f"Release[{i}] missing ReleaseResourceReferenceList")

    def _validate_deals(self, root: ET.Element, ns: str,
                         errors: List[str], warnings: List[str]) -> None:
        """Validate DealList content."""
        deal_list = root.find(f"{ns}DealList")
        if deal_list is None:
            return

        deals = deal_list.findall(f"{ns}ReleaseDeal")
        if not deals:
            errors.append("DealList must contain at least one ReleaseDeal")
            return

        for i, deal in enumerate(deals, 1):
            ref = deal.findtext(f"{ns}DealReleaseReference", "")
            if not ref:
                errors.append(f"ReleaseDeal[{i}] missing DealReleaseReference")

            # Check for DealTerms
            deal_terms_path = f"{ns}Deal/{ns}DealTerms"
            terms = deal.find(deal_terms_path)
            if terms is None:
                errors.append(f"ReleaseDeal[{i}] missing Deal/DealTerms")
            else:
                # Commercial model
                models = terms.findall(f"{ns}CommercialModelType")
                if not models:
                    warnings.append(f"ReleaseDeal[{i}] has no CommercialModelType")

                # Use type
                uses = terms.findall(f"{ns}UseType")
                if not uses:
                    warnings.append(f"ReleaseDeal[{i}] has no UseType")

                # Territory
                territory = terms.findtext(f"{ns}TerritoryCode", "")
                if not territory:
                    errors.append(f"ReleaseDeal[{i}] Deal/DealTerms missing TerritoryCode")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="DDEX ERN 4.3 XSD/Structural Validator",
        epilog=(
            "Install lxml for full XSD validation: pip install lxml\n"
            "Download DDEX XSD from: https://kb.ddex.net/display/ERNDG/ERN+4\n"
            "Set DDEX_XSD_PATH environment variable to your XSD file."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("xml_input", help="XML file path or XML string")
    parser.add_argument("--xsd", help="Path to DDEX ERN XSD schema file")
    parser.add_argument("--storage-path", help="Path for persistence (unused, for consistency)")

    args = parser.parse_args()

    validator = DDEXXSDValidator(xsd_path=args.xsd)

    if os.path.exists(args.xml_input):
        result = validator.validate_file(args.xml_input)
    else:
        result = validator.validate_xml_string(args.xml_input)

    print(json.dumps(result, indent=2))
    sys.exit(0 if result["valid"] else 1)
