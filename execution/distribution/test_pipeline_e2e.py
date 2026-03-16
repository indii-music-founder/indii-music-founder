#!/usr/bin/env python3
"""
test_pipeline_e2e.py - End-to-End DDEX Distribution Pipeline Test

Tests the complete pipeline from metadata input to delivery-ready packages:
  1. ISRC/UPC generation
  2. QC validation (metadata + style guide)
  3. DDEX ERN 4.3 XML generation
  4. XSD/structural validation
  5. Apple ITMSP packaging
  6. Spotify package creation

Does NOT require real DSP credentials or network access.
Uses a mock release with test audio and cover art files.
"""

import datetime
import hashlib
import json
import os
import sys
import tempfile
import shutil
import unittest
import xml.etree.ElementTree as ET

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ddex_generator import DDEXGenerator
from isrc_manager import IdentityManager
from qc_validator import QCValidator
from xsd_validator import DDEXXSDValidator


# ─── Test Fixtures ─────────────────────────────────────────────────────────

def create_mock_audio_file(path: str, size_bytes: int = 1024) -> str:
    """Create a mock audio file and return its MD5 hash."""
    content = os.urandom(size_bytes)
    with open(path, 'wb') as f:
        f.write(content)
    return hashlib.md5(content).hexdigest()


def create_mock_cover_art(path: str, size_bytes: int = 2048) -> str:
    """Create a mock cover art file and return its MD5 hash."""
    # Write a minimal valid JPEG header + random data
    jpeg_header = bytes([0xFF, 0xD8, 0xFF, 0xE0])  # SOI + APP0 marker
    content = jpeg_header + os.urandom(size_bytes - 4)
    with open(path, 'wb') as f:
        f.write(content)
    return hashlib.md5(content).hexdigest()


MOCK_RELEASE = {
    "title": "Test EP - Pipeline Validation",
    "artist": "Pipeline Test Artist",
    "label": "indiiOS Test Label",
    "genre": "Electronic",
    "release_date": (datetime.datetime.now() + datetime.timedelta(days=14)).strftime("%Y-%m-%d"),
    "tracks": [
        {
            "title": "Signal Chain",
            "artist": "Pipeline Test Artist",
            "duration": 245,
            "explicit": False,
            "codec": "FLAC",
            "channels": 2,
            "sample_rate": 44100,
            "bit_depth": 16,
            "filename": "01_signal_chain.flac"
        },
        {
            "title": "Binary Sunset",
            "artist": "Pipeline Test Artist",
            "duration": 198,
            "explicit": True,
            "codec": "FLAC",
            "channels": 2,
            "sample_rate": 44100,
            "bit_depth": 24,
            "filename": "02_binary_sunset.flac"
        },
        {
            "title": "Quantum Drift",
            "artist": "Pipeline Test Artist",
            "duration": 312,
            "explicit": False,
            "codec": "FLAC",
            "channels": 2,
            "sample_rate": 48000,
            "bit_depth": 24,
            "filename": "03_quantum_drift.flac"
        }
    ]
}


# ─── Tests ─────────────────────────────────────────────────────────────────

class TestFullPipeline(unittest.TestCase):
    """End-to-end tests for the complete DDEX distribution pipeline."""

    def setUp(self):
        """Create a temporary staging directory with mock files."""
        self.staging_dir = tempfile.mkdtemp(prefix="indiiOS_pipeline_test_")
        self.release_data = json.loads(json.dumps(MOCK_RELEASE))  # Deep copy

        # Create mock audio files
        for track in self.release_data["tracks"]:
            audio_path = os.path.join(self.staging_dir, track["filename"])
            track["file_hash"] = create_mock_audio_file(audio_path)

        # Create mock cover art
        cover_path = os.path.join(self.staging_dir, "cover.jpg")
        self.release_data["cover_filename"] = "cover.jpg"
        self.release_data["cover_hash"] = create_mock_cover_art(cover_path)
        self.release_data["cover_width"] = 3000
        self.release_data["cover_height"] = 3000

        # Write metadata.json for package builders
        with open(os.path.join(self.staging_dir, "metadata.json"), 'w') as f:
            json.dump(self.release_data, f, indent=2)

    def tearDown(self):
        """Clean up temporary files."""
        shutil.rmtree(self.staging_dir, ignore_errors=True)

    # ─── Step 1: Identity Generation ───────────────────────────────────

    def test_01_isrc_generation(self):
        """Test ISRC generation with a valid registrant code."""
        store_path = os.path.join(self.staging_dir, "identity_store.json")
        manager = IdentityManager(store_path=store_path)

        isrcs = []
        for track in self.release_data["tracks"]:
            isrc = manager.generate_isrc(country="US", registrant="T3S")
            self.assertRegex(isrc, r'^US-T3S-\d{2}-\d{5}$')
            track["isrc"] = isrc
            isrcs.append(isrc)

        # All ISRCs must be unique
        self.assertEqual(len(isrcs), len(set(isrcs)), "ISRCs must be unique")

    def test_02_upc_generation(self):
        """Test UPC generation with a valid GS1 prefix."""
        store_path = os.path.join(self.staging_dir, "identity_store.json")
        manager = IdentityManager(store_path=store_path)

        upc = manager.generate_upc(prefix="012345678")
        self.assertRegex(upc, r'^\d{12}$', "UPC must be exactly 12 digits")
        self.release_data["upc"] = upc

    # ─── Step 2: QC Validation ─────────────────────────────────────────

    def test_03_qc_validation_pass(self):
        """Test that valid metadata passes QC."""
        validator = QCValidator()
        result = validator.validate_metadata({
            "title": "Test EP - Pipeline Validation",
            "artist": "Pipeline Test Artist",
            "artwork_url": "https://storage.googleapis.com/test/cover.jpg"
        })

        self.assertTrue(result["valid"], f"QC should pass. Errors: {result.get('errors', [])}")
        self.assertEqual(len(result["errors"]), 0)

    def test_04_qc_validation_rejects_bad_title(self):
        """Test that QC rejects titles with contributor info."""
        validator = QCValidator()
        result = validator.validate_metadata({
            "title": "My Song feat. Other Artist",
            "artist": "Test Artist",
            "artwork_url": "https://example.com/cover.jpg"
        })

        self.assertFalse(result["valid"])
        self.assertTrue(
            any("contributor" in e.lower() for e in result["errors"]),
            "Should flag contributor info in title"
        )

    def test_05_qc_validation_rejects_generic_artist(self):
        """Test that QC rejects generic/SEO-spam artist names."""
        validator = QCValidator()
        result = validator.validate_metadata({
            "title": "Track One",
            "artist": "Chill Beats",
            "artwork_url": "https://example.com/cover.jpg"
        })

        self.assertFalse(result["valid"])
        self.assertTrue(
            any("generic" in e.lower() for e in result["errors"]),
            "Should flag generic artist name"
        )

    # ─── Step 3: DDEX ERN Generation ───────────────────────────────────

    def test_06_ddex_ern_generation(self):
        """Test DDEX ERN 4.3 XML generation."""
        # Assign test ISRCs
        for i, track in enumerate(self.release_data["tracks"], 1):
            track["isrc"] = f"US-T3S-26-{str(i).zfill(5)}"
        self.release_data["upc"] = "012345678012"

        generator = DDEXGenerator()
        xml_output = generator.generate_ern(self.release_data)

        self.assertIn("NewReleaseMessage", xml_output)
        self.assertIn("http://ddex.net/xml/ern/43", xml_output)

        # Verify all tracks are in the XML
        for track in self.release_data["tracks"]:
            self.assertIn(track["title"], xml_output)
            self.assertIn(track["isrc"], xml_output)

        # Verify cover art Image resource
        self.assertIn("<Image>", xml_output)
        self.assertIn("FrontCoverImage", xml_output)
        self.assertIn("cover.jpg", xml_output)

        # Store for later tests
        self._xml_output = xml_output

    def test_07_ddex_no_duplicate_filename(self):
        """Verify the FileName duplication bug is fixed."""
        for i, track in enumerate(self.release_data["tracks"], 1):
            track["isrc"] = f"US-T3S-26-{str(i).zfill(5)}"

        generator = DDEXGenerator()
        root = ET.Element("Root")
        sr = generator.generate_sound_recording(root, self.release_data["tracks"][0], 1)

        # Navigate to File element
        details = sr.find("SoundRecordingDetailsByTerritory")
        self.assertIsNotNone(details)
        tech = details.find("TechnicalSoundRecordingDetails")
        self.assertIsNotNone(tech)
        file_elem = tech.find("File")
        self.assertIsNotNone(file_elem)

        # Count FileName elements
        filenames = file_elem.findall("FileName")
        self.assertEqual(len(filenames), 1,
                         f"Expected exactly 1 FileName, found {len(filenames)}")

    # ─── Step 4: XSD/Structural Validation ─────────────────────────────

    def test_08_xsd_structural_validation(self):
        """Test structural validation of generated ERN XML."""
        for i, track in enumerate(self.release_data["tracks"], 1):
            track["isrc"] = f"US-T3S-26-{str(i).zfill(5)}"
        self.release_data["upc"] = "012345678012"

        generator = DDEXGenerator()
        xml_output = generator.generate_ern(self.release_data)

        validator = DDEXXSDValidator()
        result = validator.validate_xml_string(xml_output)

        self.assertTrue(
            result["valid"],
            f"Structural validation failed. Errors: {result.get('errors', [])}"
        )
        self.assertEqual(result["mode"], "structural")

    # ─── Step 5: Apple ITMSP Packaging ─────────────────────────────────

    def test_09_itmsp_packaging(self):
        """Test Apple ITMSP bundle creation."""
        try:
            from package_itmsp import package_itmsp
        except ImportError:
            self.skipTest("package_itmsp not available")

        # Assign ISRCs and create metadata
        for i, track in enumerate(self.release_data["tracks"], 1):
            track["isrc"] = f"US-T3S-26-{str(i).zfill(5)}"

        # Write updated metadata
        with open(os.path.join(self.staging_dir, "metadata.json"), 'w') as f:
            json.dump(self.release_data, f, indent=2)

        result = package_itmsp("TEST-REL-001", self.staging_dir)

        self.assertEqual(result["status"], "PASS", f"ITMSP packaging failed: {result}")
        self.assertTrue(result.get("delivery_ready", False))
        self.assertTrue(os.path.exists(result["bundle_path"]))

        # Verify bundle contains XML and audio files
        bundle_files = os.listdir(result["bundle_path"])
        self.assertIn("metadata.xml", bundle_files)
        for track in self.release_data["tracks"]:
            self.assertIn(track["filename"], bundle_files)

    # ─── Step 6: Spotify Package ───────────────────────────────────────

    def test_10_spotify_packaging(self):
        """Test Spotify SFTP delivery package creation."""
        try:
            from package_spotify import package_spotify
        except ImportError:
            self.skipTest("package_spotify not available")

        # Assign ISRCs and UPC
        for i, track in enumerate(self.release_data["tracks"], 1):
            track["isrc"] = f"US-T3S-26-{str(i).zfill(5)}"
        self.release_data["upc"] = "012345678012"

        # Write updated metadata with all identifiers
        with open(os.path.join(self.staging_dir, "metadata.json"), 'w') as f:
            json.dump(self.release_data, f, indent=2)

        output_dir = os.path.join(self.staging_dir, "output")
        os.makedirs(output_dir)

        result = package_spotify(
            release_id="TEST-REL-001",
            staging_path=self.staging_dir,
            output_path=output_dir
        )

        self.assertEqual(result["status"], "PASS", f"Spotify packaging failed: {result}")
        self.assertTrue(result.get("delivery_ready", False))
        self.assertEqual(result["track_count"], 3)

        # Verify package structure
        package_path = result["package_path"]
        self.assertTrue(os.path.exists(package_path))

        # Manifest must exist
        self.assertTrue(os.path.exists(os.path.join(package_path, "manifest.xml")))

        # ERN XML must exist
        self.assertTrue(os.path.exists(os.path.join(package_path, "TEST-REL-001.xml")))

        # Resources directory must contain audio and cover
        resources_path = os.path.join(package_path, "resources")
        self.assertTrue(os.path.exists(resources_path))
        resource_files = os.listdir(resources_path)
        self.assertIn("cover.jpg", resource_files)
        for track in self.release_data["tracks"]:
            self.assertIn(track["filename"], resource_files)

    # ─── Full Pipeline Integration ─────────────────────────────────────

    def test_11_full_pipeline_integration(self):
        """Run the complete pipeline from raw metadata to delivery-ready packages."""
        # Step 1: Generate identifiers
        store_path = os.path.join(self.staging_dir, "identity_store.json")
        manager = IdentityManager(store_path=store_path)

        for track in self.release_data["tracks"]:
            track["isrc"] = manager.generate_isrc(country="US", registrant="T3S")

        self.release_data["upc"] = manager.generate_upc(prefix="012345678")

        # Step 2: QC validation
        qc = QCValidator()
        qc_result = qc.validate_metadata({
            "title": self.release_data["title"],
            "artist": self.release_data["artist"],
            "artwork_url": "https://example.com/cover.jpg"
        })
        self.assertTrue(qc_result["valid"], f"QC failed: {qc_result['errors']}")

        # Step 3: Generate DDEX ERN 4.3
        generator = DDEXGenerator()
        xml = generator.generate_ern(self.release_data)
        self.assertIn("NewReleaseMessage", xml)

        # Step 4: Validate XML
        validator = DDEXXSDValidator()
        val_result = validator.validate_xml_string(xml)
        self.assertTrue(val_result["valid"], f"Validation failed: {val_result['errors']}")

        # Step 5: Write XML to staging for packagers
        with open(os.path.join(self.staging_dir, "metadata.json"), 'w') as f:
            json.dump(self.release_data, f, indent=2)

        # Step 6: Apple ITMSP
        try:
            from package_itmsp import package_itmsp
            itmsp_result = package_itmsp("PIPELINE-E2E-001", self.staging_dir)
            self.assertEqual(itmsp_result["status"], "PASS")
        except ImportError:
            pass

        # Step 7: Spotify Package
        try:
            from package_spotify import package_spotify
            output_dir = os.path.join(self.staging_dir, "spotify_output")
            os.makedirs(output_dir)
            spotify_result = package_spotify(
                release_id="PIPELINE-E2E-001",
                staging_path=self.staging_dir,
                output_path=output_dir
            )
            self.assertEqual(spotify_result["status"], "PASS")
        except ImportError:
            pass

        print("\n✅ Full pipeline integration test PASSED")
        print(f"   Tracks: {len(self.release_data['tracks'])}")
        print(f"   ISRCs: {[t['isrc'] for t in self.release_data['tracks']]}")
        print(f"   UPC: {self.release_data['upc']}")
        print(f"   XML size: {len(xml)} bytes")


if __name__ == "__main__":
    unittest.main(verbosity=2)
