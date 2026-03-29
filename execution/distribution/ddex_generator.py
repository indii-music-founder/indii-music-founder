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
import re
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
        full_hex = uuid.uuid4().hex
        msg_suffix = ""
        for i in range(8):
            msg_suffix += full_hex[i]
        msg_id = f"MSG-{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}-{msg_suffix.upper()}"
        
        # Message Threading

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
        title_text = track.get("title", track.get("track_title", "Untitled"))
        version = track.get("version")
        
        title_elem = self._create_element(
            details_list, "Title", TitleType="FormalTitle")
        self._create_element(title_elem, "TitleText", title_text)
        if version:
            self._create_element(title_elem, "SubTitle", version)

        # Display Artist
        artists = track.get("artists")
        primary_artist = (track.get("artist") or track.get("artist_name") or 
                         track.get("primary_artist") or "Unknown Artist")
        
        if not artists:
            artists = [primary_artist]

        for i, artist_name in enumerate(artists, 1):
             artist_elem = self._create_element(
                 details_list, "DisplayArtist", SequenceNumber=str(i))
             party_name = self._create_element(artist_elem, "PartyName")
             self._create_element(party_name, "FullName", artist_name)
             artist_role = self._create_element(artist_elem, "ArtistRole")
             role_tag = "MainArtist" if i == 1 else "FeaturedArtist"
             self._create_element(artist_role, role_tag)

        # Label Name
        label = track.get("label", "Self-Released")
        self._create_element(details_list, "LabelName", label)

        # P-Line
        p_year = datetime.datetime.now().year
        p_line_text = track.get("p_line") or f"℗ {p_year} {label}"
        
        # Safe year extraction
        p_line_year = str(p_year)
        match = re.search(r'(\d{4})', p_line_text)
        if match:
            p_line_year = match.group(0)
            
        p_line_elem = self._create_element(details_list, "PLine")
        self._create_element(p_line_elem, "Year", p_line_year)
        self._create_element(p_line_elem, "PLineText", p_line_text)

        # C-Line (Phonographic copyright owners usually own packaging too)
        c_line_text = track.get("c_line") or f"© {p_year} {label}"
        c_line_elem = self._create_element(details_list, "CLine")
        self._create_element(c_line_elem, "Year", p_line_year)
        self._create_element(c_line_elem, "CLineText", c_line_text)

        # Genre
        genre = track.get("genre", "Pop")
        sub_genre = track.get("sub_genre")
        genre_elem = self._create_element(details_list, "Genre")
        self._create_element(genre_elem, "GenreText", genre)
        if sub_genre:
            self._create_element(genre_elem, "SubGenre", sub_genre)

        # Language
        language = track.get("language")
        if language:
            # ISO 639-2 language code, often needed for DSP indexing
            self._create_element(sr, "LanguageAndScriptCode", language)

        # Marketing Comment (DSP Pitch)
        marketing_comment = track.get("marketing_comment")
        if marketing_comment:
            self._create_element(details_list, "MarketingComment", marketing_comment)

        # Audio DNA Proprietary ID (if semantic data was injected)
        audio_dna_hash = track.get("audio_dna", {}).get("hash")
        if audio_dna_hash:
            dna_id = self._create_element(sr, "SoundRecordingId")
            self._create_element(dna_id, "ProprietaryId", audio_dna_hash, Namespace="IndiiOS:AudioDNA")

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

    def generate_image_resource(self, parent: ET.Element,
                                release_data: Dict[str, Any]) -> ET.Element:
        """Generate an Image resource for cover art.

        Both Apple Music and Spotify require cover art as a resource in the ERN.
        Apple: minimum 3000x3000 pixels, JPEG or PNG.
        Spotify: minimum 3000x3000 pixels, JPEG.
        """
        image = self._create_element(parent, "Image")

        # Image Type
        self._create_element(image, "ImageType", "FrontCoverImage")

        # Image ID (ProprietaryId fallback if no standard ID)
        image_id = self._create_element(image, "ImageId")
        self._create_element(image_id, "ProprietaryId",
                             release_data.get("cover_id", "COVER001"),
                             Namespace=self.sender_dpid)

        # Resource Reference (used to link to Release)
        self._create_element(image, "ResourceReference", "A0")

        # Image Details By Territory
        details = self._create_element(image, "ImageDetailsByTerritory")
        self._create_element(details, "TerritoryCode", "Worldwide")

        # Technical Details
        tech = self._create_element(details, "TechnicalImageDetails")
        self._create_element(tech, "TechnicalResourceDetailsReference", "T0")

        # Image Codec
        cover_filename = release_data.get("cover_filename", "cover.jpg")
        codec = "JPEG"
        if cover_filename.lower().endswith(".png"):
            codec = "PNG"
        self._create_element(tech, "ImageCodecType", codec)

        # Image dimensions (mandatory for Apple Music — minimum 3000x3000)
        width = release_data.get("cover_width", 3000)
        height = release_data.get("cover_height", 3000)
        self._create_element(tech, "ImageWidth", str(width))
        self._create_element(tech, "ImageHeight", str(height))

        # File Details
        file_elem = self._create_element(tech, "File")
        self._create_element(file_elem, "FileName", cover_filename)

        # Cover art hash
        cover_hash = release_data.get("cover_hash")
        if cover_hash:
            hash_elem = self._create_element(file_elem, "HashSum")
            self._create_element(hash_elem, "HashSumValue", cover_hash)
            self._create_element(hash_elem, "HashSumAlgorithmType", "MD5")

        return image

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
        raw_artists = release_data.get("artists")
        primary_artist = (release_data.get("artist") or 
                         release_data.get("primary_artist") or "Unknown Artist")
        
        if isinstance(raw_artists, list):
            artists = raw_artists
        elif isinstance(raw_artists, str):
            artists = [raw_artists]
        else:
            artists = [primary_artist]

        display_artist_name = ", ".join(artists)
        artist_elem = self._create_element(details, "DisplayArtistName")
        self._create_element(artist_elem, "FullName", display_artist_name)

        # Release Title
        release_title = release_data.get("title") or release_data.get("album_title") or "Untitled Release"
        version = release_data.get("version")
        
        title_elem = self._create_element(
            details, "Title", TitleType="FormalTitle")
        self._create_element(title_elem, "TitleText", release_title)
        if version:
            self._create_element(title_elem, "SubTitle", version)

        # Display Artist
        for i, artist_name in enumerate(artists, 1):
             display_artist = self._create_element(
                 details, "DisplayArtist", SequenceNumber=str(i))
             party_name = self._create_element(display_artist, "PartyName")
             self._create_element(party_name, "FullName", artist_name)
             artist_role = self._create_element(display_artist, "ArtistRole")
             role_tag = "MainArtist" if i == 1 else "FeaturedArtist"
             self._create_element(artist_role, role_tag)

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
        l_name = release_data.get("label", "Self-Released")
        
        p_line_text = release_data.get("p_line") or f"℗ {c_year} {l_name}"
        c_line_text = release_data.get("c_line") or f"© {c_year} {l_name}"
        
        p_line_year = str(c_year)
        match = re.search(r'(\d{4})', p_line_text)
        if match:
            p_line_year = match.group(0)

        c_line_elem = self._create_element(details, "CLine")
        self._create_element(c_line_elem, "Year", p_line_year)
        self._create_element(c_line_elem, "CLineText", c_line_text)

        p_line_elem = self._create_element(details, "PLine")
        self._create_element(p_line_elem, "Year", p_line_year)
        self._create_element(p_line_elem, "PLineText", p_line_text)

        # Release Resource Reference List
        rr_list = self._create_element(release, "ReleaseResourceReferenceList")

        # Cover art reference (A0 = Image resource)
        if release_data.get("cover_filename") or release_data.get("cover_hash"):
            self._create_element(rr_list, "ReleaseResourceReference", "A0",
                                 ReleaseResourceType="SecondaryResource")

        # Track references (A1, A2, ... = SoundRecording resources)
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

        # Resource List
        resource_list = self._create_element(root, "ResourceList")

        # Cover Art Image (required by Apple Music and Spotify)
        if release_data.get("cover_filename") or release_data.get("cover_hash"):
            self.generate_image_resource(resource_list, release_data)

        # Sound Recordings
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
