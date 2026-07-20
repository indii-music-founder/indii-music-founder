import json
import hashlib
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch


MODULE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(MODULE_DIR))

import ingestion_build  # noqa: E402
import package_itmsp  # noqa: E402
import package_spotify  # noqa: E402


TEST_SENDER_DPID = "PA-DPIDA-2014122301-Q"
TEST_RECIPIENT_DPID = "PA-DPIDA-3897722461-G"
TEST_XML = '<NewReleaseMessage xmlns="http://ddex.net/xml/ern/43" />'
TEST_MANIFEST_NAMESPACE = "urn:ddex:test:manifest"


def release_fixture() -> dict:
    return {
        "releaseId": "release-test-001",
        "title": "Delivery Gate Test",
        "artist": "Test Artist",
        "artists": ["Test Artist"],
        "label": "Test Label",
        "genre": "Electronic",
        "upc": "012345678012",
        "recipient_dpid": TEST_RECIPIENT_DPID,
        "cover_filename": "cover.jpg",
        "tracks": [
            {
                "title": "Signal Path",
                "artist": "Test Artist",
                "artists": ["Test Artist"],
                "isrc": "UST3S2600001",
                "duration": 180,
                "filename": "track.flac",
            }
        ],
    }


def write_staging_directory(root: str) -> None:
    release = release_fixture()
    Path(root, "metadata.json").write_text(json.dumps(release), encoding="utf-8")
    Path(root, "track.flac").write_bytes(b"lossless-master-fixture")
    Path(root, "cover.jpg").write_bytes(b"cover-art-fixture")


def attach_verified_cover(release: dict, storage_path: str) -> bytes:
    """Add the same canonical-cover contract Electron supplies to Python."""
    cover_bytes = b"canonical-cover-art-fixture"
    cover_path = Path(storage_path, "verified-cover.jpg")
    cover_path.write_bytes(cover_bytes)
    release["cover_asset"] = {
        "content_hash": hashlib.sha256(cover_bytes).hexdigest(),
        "local_path": str(cover_path),
        "mime_type": "image/jpeg",
        "original_file_name": "cover.jpg",
        "size_bytes": len(cover_bytes),
        "width": 3000,
        "height": 3000,
    }
    return cover_bytes


class TestDDEXDeliveryReadiness(unittest.TestCase):
    def test_manifest_requires_configured_sender_dpid(self):
        with patch.dict(os.environ, {"DDEX_SENDER_DPID": ""}):
            with self.assertRaisesRegex(ValueError, "DDEX_SENDER_DPID"):
                package_spotify.generate_manifest("batch-1", [], TEST_MANIFEST_NAMESPACE)

    def test_manifest_uses_official_namespace_and_canonical_sender_dpid(self):
        with patch.dict(os.environ, {"DDEX_SENDER_DPID": TEST_SENDER_DPID}):
            manifest = package_spotify.generate_manifest(
                "batch-1",
                [],
                TEST_MANIFEST_NAMESPACE,
            )

        self.assertIn(f'xmlns="{TEST_MANIFEST_NAMESPACE}"', manifest)
        self.assertIn("<PartyId>PADPIDA2014122301Q</PartyId>", manifest)
        self.assertNotIn("http://ingestion.net", manifest)

    def test_live_ingestion_blocks_sftp_when_official_xsd_is_unavailable(self):
        release = release_fixture()
        release["sftpConfig"] = {
            "host": "delivery.example.test",
            "user": "provider",
            "remotePath": "/incoming",
        }

        validation = {
            "valid": False,
            "mode": "none",
            "errors": ["Official DDEX ERN 4.3 XSD is unavailable"],
            "warnings": [],
            "summary": "Official DDEX ERN 4.3 XSD is unavailable",
        }
        uploader = MagicMock()

        with tempfile.TemporaryDirectory() as storage_path, \
                patch.object(ingestion_build, "QCValidator") as qc_class, \
                patch.object(ingestion_build, "IdentityManager"), \
                patch.object(ingestion_build, "DDEXGenerator") as generator_class, \
                patch.object(ingestion_build, "DDEXXSDValidator", create=True) as validator_class, \
                patch.object(ingestion_build, "SFTPUploader", return_value=uploader):
            master_bytes = b"canonical-master-before-xsd-gate"
            master_path = Path(storage_path, "verified-source.flac")
            master_path.write_bytes(master_bytes)
            release["tracks"][0]["master_asset"] = {
                "content_hash": hashlib.sha256(master_bytes).hexdigest(),
                "local_path": str(master_path),
                "master_fingerprint": "SONIC-xsd-gate",
                "mime_type": "audio/flac",
                "original_file_name": "track.flac",
                "size_bytes": len(master_bytes),
                "storage_path": "masters/owner/hash/original.flac",
            }
            attach_verified_cover(release, storage_path)
            qc_class.return_value.validate_metadata.return_value = {
                "valid": True,
                "errors": [],
                "warnings": [],
            }
            generator_class.return_value.generate_ern.return_value = TEST_XML
            validator_class.return_value.validate_xml_string.return_value = validation

            result = ingestion_build.run(release, storage_path, dry_run=False)

        validator_class.assert_called_once_with(require_xsd=True)
        self.assertEqual(result["status"], "FAIL")
        self.assertEqual(result["stage"], "ddex_validation")
        uploader.upload.assert_not_called()

    def test_live_ingestion_uploads_a_package_containing_the_verified_master(self):
        master_bytes = b"canonical-lossless-master"
        release = release_fixture()
        release["sftpConfig"] = {
            "host": "delivery.example.test",
            "user": "provider",
            "remotePath": "/incoming/release-test-001",
        }
        uploader = MagicMock()
        uploader.upload.return_value = {"status": "SUCCESS"}
        xsd_pass = {
            "valid": True,
            "mode": "xsd",
            "errors": [],
            "warnings": [],
            "summary": "XSD validation passed",
        }

        with tempfile.TemporaryDirectory() as storage_path:
            source_path = Path(storage_path, "verified-source.flac")
            source_path.write_bytes(master_bytes)
            release["tracks"][0]["master_asset"] = {
                "content_hash": hashlib.sha256(master_bytes).hexdigest(),
                "local_path": str(source_path),
                "master_fingerprint": "SONIC-master-1",
                "mime_type": "audio/flac",
                "original_file_name": "signal-path.flac",
                "size_bytes": len(master_bytes),
                "storage_path": "masters/owner/hash/original.flac",
            }
            cover_bytes = attach_verified_cover(release, storage_path)

            with patch.object(ingestion_build, "QCValidator") as qc_class, \
                    patch.object(ingestion_build, "IdentityManager"), \
                    patch.object(ingestion_build, "DDEXGenerator") as generator_class, \
                    patch.object(ingestion_build, "DDEXXSDValidator") as validator_class, \
                    patch.object(ingestion_build, "SFTPUploader", return_value=uploader):
                qc_class.return_value.validate_metadata.return_value = {
                    "valid": True,
                    "errors": [],
                    "warnings": [],
                }
                generator_class.return_value.generate_ern.return_value = TEST_XML
                validator_class.return_value.validate_xml_string.return_value = xsd_pass

                result = ingestion_build.run(release, storage_path, dry_run=False)

            uploaded_path = Path(uploader.upload.call_args.kwargs["local_path"])
            staged_master = uploaded_path / "resources" / "01-signal-path.flac"
            staged_cover = uploaded_path / "resources" / f"cover-{hashlib.sha256(cover_bytes).hexdigest()[:16]}.jpg"
            self.assertTrue(uploaded_path.is_dir())
            self.assertEqual(staged_master.read_bytes(), master_bytes)
            self.assertEqual(staged_cover.read_bytes(), cover_bytes)
            self.assertEqual(Path(result["xml_path"]).parent, uploaded_path)
            generated_release = generator_class.return_value.generate_ern.call_args.args[0]
            self.assertEqual(generated_release["tracks"][0]["filename"], "resources/01-signal-path.flac")
            self.assertEqual(
                generated_release["tracks"][0]["file_hash"],
                hashlib.md5(master_bytes).hexdigest(),
            )
            self.assertEqual(
                generated_release["cover_filename"],
                f"resources/{staged_cover.name}",
            )
            self.assertTrue(result["delivery_ready"])

    def test_live_ingestion_blocks_sftp_when_canonical_cover_is_missing(self):
        release = release_fixture()
        release["sftpConfig"] = {
            "host": "delivery.example.test",
            "user": "provider",
            "remotePath": "/incoming/release-test-001",
        }
        uploader = MagicMock()
        master_bytes = b"canonical-master-cover-required"

        with tempfile.TemporaryDirectory() as storage_path, \
                patch.object(ingestion_build, "QCValidator") as qc_class, \
                patch.object(ingestion_build, "IdentityManager"), \
                patch.object(ingestion_build, "DDEXGenerator"), \
                patch.object(ingestion_build, "SFTPUploader", return_value=uploader):
            source_path = Path(storage_path, "verified-source.flac")
            source_path.write_bytes(master_bytes)
            release["tracks"][0]["master_asset"] = {
                "content_hash": hashlib.sha256(master_bytes).hexdigest(),
                "local_path": str(source_path),
                "master_fingerprint": "SONIC-cover-required",
                "mime_type": "audio/flac",
                "original_file_name": "signal-path.flac",
                "size_bytes": len(master_bytes),
                "storage_path": "masters/owner/hash/original.flac",
            }
            qc_class.return_value.validate_metadata.return_value = {
                "valid": True,
                "errors": [],
                "warnings": [],
            }

            result = ingestion_build.run(release, storage_path, dry_run=False)

        self.assertEqual(result["status"], "FAIL")
        self.assertEqual(result["stage"], "master_staging")
        self.assertIn("canonical cover_asset", result["errors"][0])
        uploader.upload.assert_not_called()

    def test_spotify_package_is_not_delivery_ready_without_xsd_proof(self):
        validation = {
            "valid": False,
            "mode": "none",
            "errors": ["Official DDEX ERN 4.3 XSD is unavailable"],
            "warnings": [],
            "summary": "Official DDEX ERN 4.3 XSD is unavailable",
        }

        with tempfile.TemporaryDirectory() as staging_path, \
                patch.dict(os.environ, {"DDEX_SENDER_DPID": TEST_SENDER_DPID}), \
                patch.object(package_spotify, "DDEXGenerator") as generator_class, \
                patch.object(package_spotify, "DDEXXSDValidator", create=True) as validator_class:
            write_staging_directory(staging_path)
            generator_class.return_value.generate_ern.return_value = TEST_XML
            validator_class.return_value.validate_xml_string.return_value = validation

            result = package_spotify.package_spotify(
                "release-test-001",
                staging_path,
                os.path.join(staging_path, "output"),
            )

        validator_class.assert_called_once_with(require_xsd=True)
        self.assertEqual(result["status"], "FAIL")
        self.assertFalse(result["delivery_ready"])

    def test_spotify_package_requires_choreography_manifest_profile(self):
        xsd_pass = {
            "valid": True,
            "mode": "xsd",
            "errors": [],
            "warnings": [],
            "summary": "XSD validation passed",
        }

        with tempfile.TemporaryDirectory() as staging_path, \
                patch.dict(os.environ, {
                    "DDEX_SENDER_DPID": TEST_SENDER_DPID,
                    "DDEX_MANIFEST_NAMESPACE": "",
                    "DDEX_MANIFEST_XSD_PATH": "",
                }), \
                patch.object(package_spotify, "DDEXGenerator") as generator_class, \
                patch.object(package_spotify, "DDEXXSDValidator") as validator_class:
            write_staging_directory(staging_path)
            generator_class.return_value.generate_ern.return_value = TEST_XML
            validator_class.return_value.validate_xml_string.return_value = xsd_pass

            result = package_spotify.package_spotify(
                "release-test-001",
                staging_path,
                os.path.join(staging_path, "output"),
            )

        self.assertEqual(result["status"], "FAIL")
        self.assertFalse(result["delivery_ready"])
        self.assertIn("DDEX_MANIFEST_NAMESPACE", result["error"])

    def test_itmsp_package_is_not_delivery_ready_without_xsd_proof(self):
        validation = {
            "valid": False,
            "mode": "none",
            "errors": ["Official DDEX ERN 4.3 XSD is unavailable"],
            "warnings": [],
            "summary": "Official DDEX ERN 4.3 XSD is unavailable",
        }

        with tempfile.TemporaryDirectory() as staging_path, \
                patch.dict(os.environ, {"DDEX_SENDER_DPID": TEST_SENDER_DPID}), \
                patch.object(package_itmsp, "DDEXGenerator") as generator_class, \
                patch.object(package_itmsp, "DDEXXSDValidator", create=True) as validator_class:
            write_staging_directory(staging_path)
            generator_class.return_value.generate_ern.return_value = TEST_XML
            validator_class.return_value.validate_xml_string.return_value = validation

            result = package_itmsp.package_itmsp("release-test-001", staging_path)

        validator_class.assert_called_once_with(require_xsd=True)
        self.assertEqual(result["status"], "FAIL")
        self.assertFalse(result["delivery_ready"])


if __name__ == "__main__":
    unittest.main()
