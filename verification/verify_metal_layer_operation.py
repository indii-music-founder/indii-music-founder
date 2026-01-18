import sys
import os
import json
import logging
import shutil
import tempfile
import hashlib

# Add execution directories to sys.path
BASE_DIR = os.getcwd()
sys.path.append(os.path.join(BASE_DIR, 'execution', 'distribution'))

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("MetalVerification")

def create_dummy_staging(release_id):
    staging_dir = tempfile.mkdtemp(prefix=f"staging_{release_id}_")

    # Create dummy audio
    audio_filename = "track_01.flac"
    audio_path = os.path.join(staging_dir, audio_filename)
    with open(audio_path, 'wb') as f:
        f.write(b"fake audio content")

    # Calculate expected hash
    md5 = hashlib.md5(b"fake audio content").hexdigest()

    # Create metadata.json
    metadata = {
        "tracks": [
            {
                "title": "Metal Layer Test",
                "isrc": "US-MTL-23-00001",
                "filename": audio_filename
            }
        ],
        "artist": "Iron Maiden",
        "album_title": "The Number of the Beast",
        "upc": "666666666666",
        "label": "Sanctuary Records"
    }

    with open(os.path.join(staging_dir, "metadata.json"), 'w') as f:
        json.dump(metadata, f)

    return staging_dir, md5

def verify_itmsp_package(release_id, staging_dir, expected_hash):
    try:
        import package_itmsp

        # Run the packaging
        result = package_itmsp.package_itmsp(release_id, staging_dir)

        if result['status'] != 'PASS':
            print(f"FAIL: Packaging returned status {result['status']}: {result.get('error')}")
            return False

        bundle_path = result['bundle_path']
        if not os.path.exists(bundle_path):
             print(f"FAIL: Bundle path {bundle_path} does not exist.")
             return False

        if not bundle_path.endswith(".itmsp"):
             print(f"FAIL: Bundle path does not end in .itmsp")
             return False

        # Check Contents
        xml_path = os.path.join(bundle_path, "metadata.xml")
        if not os.path.exists(xml_path):
            print("FAIL: metadata.xml not found in bundle.")
            return False

        audio_path = os.path.join(bundle_path, "track_01.flac")
        if not os.path.exists(audio_path):
            print("FAIL: Audio file not found in bundle.")
            return False

        # Check XML Content for Hash
        with open(xml_path, 'r') as f:
            xml_content = f.read()

        if expected_hash not in xml_content:
            print(f"FAIL: Expected MD5 hash {expected_hash} not found in XML.")
            print(f"XML Preview: {xml_content[:500]}...")
            return False

        print("PASS: ITMSP Bundle structure and content verified.")
        return True

    except ImportError:
        print("FAIL: Could not import package_itmsp.")
        return False
    except Exception as e:
        print(f"FAIL: Exception during verification: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        # Cleanup
        if os.path.exists(staging_dir):
            shutil.rmtree(staging_dir)
        # Cleanup bundle if it was created in temp (script usually creates it sibling to staging)
        # We need to find where it put it.
        # package_itmsp says: os.path.join(os.path.dirname(staging_path), f"{release_id}.itmsp")
        # Since staging_path is in /tmp/..., the bundle is also there.

if __name__ == "__main__":
    release_id = "REL_METAL_001"
    staging, expected_hash = create_dummy_staging(release_id)
    verify_itmsp_package(release_id, staging, expected_hash)
