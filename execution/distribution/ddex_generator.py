#!/usr/bin/env python3
"""
ddex_generator.py - DDEX ERN 4.3 XML Generator

Industrial-grade DDEX Electronic Release Notification generator
for direct ingestion by Apple Music, Spotify, Amazon, and other DSPs.

Implements DDEX ERN 4.3 standard (https://kb.ddex.net/display/ERNDG/ERN+4)
"""

import datetime
import json
import logging
import os
import sys
import uuid
import xml.etree.ElementTree as ET
from typing import Any, Dict, Optional
from xml.dom import minidom

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("ddex_generator")


class DDEXGenerator:
    """Generates DDEX ERN 4.3 compliant XML messages.

    This generator creates NewReleaseMessage documents for
    digital music distribution to DSPs.
    """

    # DDEX Namespace
    ERN_NS = "http://ddex.net/xml/ern/43"

    # Registered DPID for New Detroit Music LLC (dpid.ddex.net)
    # Override via DDEX_SENDER_DPID env var for multi-tenant deployments
    DEFAULT_SENDER_DPID = os.environ.get("DDEX_SENDER_DPID", "PA-DPIDA-2025122604-E")
    DEFAULT_SENDER_NAME = os.environ.get("DDEX_SENDER_NAME", "New Detroit Music LLC")

    def __init__(self, sender_dpid: Optional[str] = None,
                 sender_name: Optional[str] = None):
        """Initialize the DDEX Generator.

        Args:
            sender_dpid: DDEX Party ID for the sender (distributor).
                         Defaults to DDEX_SENDER_DPID env var or the registered indiiOS DPID.
            sender_name: Human-readable sender name.
                         Defaults to DDEX_SENDER_NAME env var or 'New Detroit Music LLC'.
        """
        self.sender_dpid = sender_dpid or self.DEFAULT_SENDER_DPID
        self.sender_name = sender_name or self.DEFAULT_SENDER_NAME

    def _create_element(self, parent: Optional[ET.Element], tag: str,
                        text: Optional[str] = None, **attrs) -> ET.Element:
        """Helper to create an XML element with optional text and attributes."""
        elem = ET.SubElement(
            parent, tag) if parent is not None else ET.Element(tag)
        if text:
            elem.text = str(text)
        for key, value in attrs.items():
            if value is not None:
                elem.set(key, str(value))
        return elem

    def generate_message_header(
            self,
            root: ET.Element,
            recipient_dpid: str = "PADPIDA0000000000Y") -> ET.Element:
        """Generate the MessageHeader element."""
        header = self._create_element(root, "MessageHeader")

        # Message Threading
        thread_id = str(uuid.uuid4())
        msg_id = f"MSG-{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:8].upper()}"

        self._create_element(header, "MessageThreadId", thread_id)
        self._create_element(header, "MessageId", msg_id)

        # Message Sender
        sender_party = self._create_element(header, "MessageSender")
        self._create_element(sender_party, "PartyId", self.sender_dpid)
        party_name = self._create_element(sender_party, "PartyName")
        self._create_element(party_name, "FullName", self.sender_name)

        # Message Recipient
        recipient_party = self._create_element(header, "MessageRecipient")
        self._create_element(recipient_party, "PartyId", recipient_dpid)

        # Message Created DateTime
        self._create_element(
            header,
            "MessageCreatedDateTime",
            datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"))

        return header

    def generate_sound_recording(self, parent: ET.Element, track: Dict[str, Any],
                                 track_num: int) -> ET.Element:
        """Generate a SoundRecording ResourceGroup."""
        sr = self._create_element(parent, "SoundRecording")

        # Sound Recording Type
        self._create_element(
            sr,
            "SoundRecordingType",
            "MusicalWorkSoundRecording")

        # ISRC
        isrc = track.get("isrc", "")
        if isrc:
            sr_id = self._create_element(sr, "SoundRecordingId")
            self._create_element(sr_id, "ISRC", isrc)

        # Reference Title
        ref_title = self._create_element(sr, "ReferenceTitle")
        self._create_element(
            ref_title, "TitleText", track.get(
                "title", track.get("track_title", "Untitled")))

        # Resource Reference (internal identifier)
        self._create_element(sr, "ResourceReference", f"A{track_num}")

        # Duration (ISO 8601 duration format)
        duration_sec = track.get("duration", 180)  # Default 3 minutes
        minutes = int(duration_sec // 60)
        seconds = int(duration_sec % 60)
        self._create_element(sr, "Duration", f"PT{minutes}M{seconds}S")

        # Sound Recording Details List
        details_list = self._create_element(
            sr, "SoundRecordingDetailsByTerritory")
        self._create_element(details_list, "TerritoryCode", "Worldwide")

        # Title
        title_elem = self._create_element(
            details_list, "Title", TitleType="FormalTitle")
        self._create_element(
            title_elem, "TitleText", track.get(
                "title", track.get("track_title", "Untitled")))

        # Display Artist
        artist_name = track.get("artist") or track.get("artist_name") or track.get("primary_artist")
        if not artist_name and track.get("artists") and isinstance(track.get("artists"), list):
             artist_name = track.get("artists")[0]
        artist_name = artist_name or "Unknown Artist"

        artist = self._create_element(
            details_list, "DisplayArtist", SequenceNumber="1")
        party_name = self._create_element(artist, "PartyName")
        self._create_element(party_name, "FullName", artist_name)
        artist_role = self._create_element(artist, "ArtistRole")
        self._create_element(artist_role, "MainArtist")

        # Label Name
        label = track.get("label", "Self-Released")
        self._create_element(details_list, "LabelName", label)

        # P-Line
        p_year = datetime.datetime.now().year
        p_line = self._create_element(details_list, "PLine")
        self._create_element(p_line, "Year", str(p_year))
        self._create_element(p_line, "PLineText", f"℗ {p_year} {label}")

        # Genre
        genre = track.get("genre", "Pop")
        genre_elem = self._create_element(details_list, "Genre")
        self._create_element(genre_elem, "GenreText", genre)

        # Parental Warning
        self._create_element(
            details_list,
            "ParentalWarningType",
            "Explicit" if track.get(
                "explicit",
                False) else "NotExplicit")

        # Technical Details
        tech_details = self._create_element(
            details_list, "TechnicalSoundRecordingDetails")
        self._create_element(
            tech_details,
            "TechnicalResourceDetailsReference",
            f"T{track_num}")
        self._create_element(
            tech_details,
            "AudioCodecType",
            track.get(
                "codec",
                "FLAC"))
        self._create_element(
            tech_details, "NumberOfChannels", str(
                track.get(
                    "channels", 2)))
        self._create_element(
            tech_details, "SamplingRate", str(
                track.get(
                    "sample_rate", 44100)))
        self._create_element(
            tech_details, "BitsPerSample", str(
                track.get(
                    "bit_depth", 16)))

        # File Details
        file_elem = self._create_element(tech_details, "File")
        self._create_element(file_elem, "FileName", track.get("filename", f"track_{track_num}.flac"))
        
        # HashSum (MD5)
        file_hash = track.get("file_hash")
        if file_hash:
            hash_elem = self._create_element(file_elem, "HashSum")
            self._create_element(hash_elem, "HashSumValue", file_hash)
            self._create_element(hash_elem, "HashSumAlgorithmType", "MD5")

        return sr

    def generate_release(self,
                         parent: ET.Element,
                         release_data: Dict[str,
                                            Any]) -> ET.Element:
        """Generate a Release element."""
        release = self._create_element(parent, "Release")

        # Release ID (UPC/EAN)
        upc = release_data.get("upc", "")
        if upc:
            release_id = self._create_element(release, "ReleaseId")
            self._create_element(release_id, "ICPN", upc)

        # Release Reference
        self._create_element(release, "ReleaseReference", "R0")

        # Release Type
        track_count = len(release_data.get("tracks", []))
        release_type = "Single" if track_count <= 3 else "Album"
        self._create_element(release, "ReleaseType", release_type)

        # Release Details By Territory
        details = self._create_element(release, "ReleaseDetailsByTerritory")
        self._create_element(details, "TerritoryCode", "Worldwide")

        # Display Artist Name
        artist_name = release_data.get("artist") or release_data.get("primary_artist")
        if not artist_name and release_data.get("artists") and isinstance(release_data.get("artists"), list):
             artist_name = release_data.get("artists")[0]
        artist_name = artist_name or "Unknown Artist"

        artist_elem = self._create_element(details, "DisplayArtistName")
        self._create_element(artist_elem, "FullName", artist_name)

        # Release Title
        release_title = release_data.get("title") or release_data.get("album_title") or "Untitled Release"
        title_elem = self._create_element(
            details, "Title", TitleType="FormalTitle")
        self._create_element(title_elem, "TitleText", release_title)

        # Display Artist
        display_artist = self._create_element(
            details, "DisplayArtist", SequenceNumber="1")
        party_name = self._create_element(display_artist, "PartyName")
        self._create_element(party_name, "FullName", artist_name)
        artist_role = self._create_element(display_artist, "ArtistRole")
        self._create_element(artist_role, "MainArtist")

        # Label Name
        label = release_data.get("label", "Self-Released")
        self._create_element(details, "LabelName", label)

        # Original Release Date
        release_date = release_data.get(
            "release_date", datetime.datetime.now().strftime("%Y-%m-%d"))
        self._create_element(details, "OriginalReleaseDate", release_date)

        # Genre
        genre_elem = self._create_element(details, "Genre")
        self._create_element(
            genre_elem,
            "GenreText",
            release_data.get(
                "genre",
                "Pop"))

        # Parental Warning
        has_explicit = any(t.get("explicit", False)
                           for t in release_data.get("tracks", []))
        self._create_element(details, "ParentalWarningType",
                             "Explicit" if has_explicit else "NotExplicit")

        # C-Line and P-Line
        c_year = datetime.datetime.now().year
        c_line = self._create_element(details, "CLine")
        self._create_element(c_line, "Year", str(c_year))
        self._create_element(c_line, "CLineText", f"© {c_year} {label}")

        p_line = self._create_element(details, "PLine")
        self._create_element(p_line, "Year", str(c_year))
        self._create_element(p_line, "PLineText", f"℗ {c_year} {label}")

        # Release Resource Reference List
        rr_list = self._create_element(release, "ReleaseResourceReferenceList")
        for i, track in enumerate(release_data.get("tracks", []), 1):
            self._create_element(rr_list, "ReleaseResourceReference", f"A{i}",
                                 ReleaseResourceType="PrimaryResource")

        return release

    def generate_deal(self,
                      parent: ET.Element,
                      release_data: Dict[str,
                                         Any]) -> ET.Element:
        """Generate a ReleaseDeal element for the release."""
        deal = self._create_element(parent, "ReleaseDeal")

        # Deal Release Reference
        self._create_element(deal, "DealReleaseReference", "R0")

        # Deal Terms
        terms = self._create_element(deal, "Deal")
        terms_detail = self._create_element(terms, "DealTerms")

        # Commercial Model Type
        self._create_element(
            terms_detail,
            "CommercialModelType",
            "SubscriptionModel")
        self._create_element(
            terms_detail,
            "CommercialModelType",
            "PayAsYouGoModel")

        # Usage (streaming allowed)
        self._create_element(terms_detail, "UseType", "OnDemandStream")
        self._create_element(terms_detail, "UseType", "PermanentDownload")

        # Territory
        self._create_element(terms_detail, "TerritoryCode", "Worldwide")

        # Validity Period
        validity = self._create_element(terms_detail, "ValidityPeriod")
        start_date = release_data.get(
            "release_date",
            datetime.datetime.now().strftime("%Y-%m-%d"))
        self._create_element(validity, "StartDate", start_date)

        return deal

    def generate_ern(self, release_data: Dict[str, Any]) -> str:
        """Generate a complete DDEX ERN 4.3 NewReleaseMessage."""
        # Create root element with namespace
        root = ET.Element("NewReleaseMessage")
        root.set("xmlns", self.ERN_NS)
        root.set("ReleaseProfileVersionId", "CommonReleaseTypes/14")
        root.set("LanguageAndScriptCode", "en")

        # Message Header
        self.generate_message_header(root)

        # Resource List (Sound Recordings)
        resource_list = self._create_element(root, "ResourceList")
        tracks = release_data.get("tracks", [])
        for i, track in enumerate(tracks, 1):
            self.generate_sound_recording(resource_list, track, i)

        # Release List
        release_list = self._create_element(root, "ReleaseList")
        self.generate_release(release_list, release_data)

        # Deal List
        deal_list = self._create_element(root, "DealList")
        self.generate_deal(deal_list, release_data)

        # Pretty print
        xml_string = ET.tostring(root, encoding='unicode')
        dom = minidom.parseString(xml_string)
        pretty_xml = dom.toprettyxml(indent="  ")

        # Remove extra blank lines
        lines = [line for line in pretty_xml.split('\n') if line.strip()]
        return '\n'.join(lines)


# Legacy compatibility function
def generate_ddex(artist_data: Dict[str, Any]) -> str:
    """Legacy wrapper for backward compatibility."""
    generator = DDEXGenerator()
    return generator.generate_ern(artist_data)



if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="DDEX ERN 4.3 Generator")
    parser.add_argument("json_data", help="JSON payload string")
    parser.add_argument("--storage-path", help="Optional path for file persistence")

    args = parser.parse_args()

    try:
        # Parse input JSON
        release_data = json.loads(args.json_data)

        # Generate DDEX XML
        generator = DDEXGenerator()
        xml_output = generator.generate_ern(release_data)

        # Return as JSON with the XML embedded
        result = {
            "status": "SUCCESS",
            "message_type": "NewReleaseMessage",
            "profile_version": "CommonReleaseTypes/14",
            "track_count": len(release_data.get("tracks", [])),
            "xml": xml_output
        }
        print(json.dumps(result, indent=2))

    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON input: {e}")
        print(json.dumps({"error": f"Invalid JSON: {str(e)}"}))
        sys.exit(1)
    except Exception as e:
        logger.exception("DDEX Generator Execution Error")
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
