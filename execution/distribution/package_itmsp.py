import json
import sys
import os
import shutil
import hashlib
import logging

# Ensure we can import sibling modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
try:
    from ddex_generator import DDEXGenerator
except ImportError:
    # Fallback if running from a different context
    pass

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("package_itmsp")

def calculate_md5(file_path):
    """Calculates the MD5 checksum of a file."""
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()

def package_itmsp(release_id, staging_path):
    """
    Creates an Apple ITMSP bundle from a staged release.

    1. Validates staging directory and metadata.
    2. Calculates checksums for assets.
    3. Generates DDEX ERN 4.3 XML.
    4. Creates .itmsp directory structure.
    5. Moves assets and XML into the bundle.
    """
    logger.info(f"Starting ITMSP packaging for release {release_id} from {staging_path}")

    try:
        # 1. Validation
        if not os.path.exists(staging_path):
            return {"status": "FAIL", "error": f"Staging path {staging_path} does not exist"}

        metadata_path = os.path.join(staging_path, "metadata.json")
        if not os.path.exists(metadata_path):
            return {"status": "FAIL", "error": "metadata.json not found in staging directory"}

        with open(metadata_path, 'r') as f:
            metadata = json.load(f)

        # 2. Asset Processing & Checksums
        tracks = metadata.get("tracks", [])
        processed_tracks = []
        
        for track in tracks:
            filename = track.get("filename")
            if not filename:
                logger.warning(f"Track {track.get('title')} has no filename. Skipping file check.")
                processed_tracks.append(track)
                continue

            file_path = os.path.join(staging_path, filename)
            if not os.path.exists(file_path):
                 return {"status": "FAIL", "error": f"Asset file {filename} missing from staging"}

            # Calculate hash
            md5_hash = calculate_md5(file_path)
            track["file_hash"] = md5_hash

            # Get file size if needed, but MD5 is key
            processed_tracks.append(track)

        metadata["tracks"] = processed_tracks

        # 3. Generate XML
        try:
            generator = DDEXGenerator()
            xml_content = generator.generate_ern(metadata)
        except NameError:
             # Handle case where import failed
             from ddex_generator import DDEXGenerator
             generator = DDEXGenerator()
             xml_content = generator.generate_ern(metadata)

        # 4. Create Bundle Structure
        # ITMSP bundles are directories ending in .itmsp
        # Usually placed alongside the staging dir or in a specific output dir.
        # Here we place it alongside staging.
        bundle_name = f"{release_id}.itmsp"
        bundle_path = os.path.join(os.path.dirname(staging_path), bundle_name)

        if os.path.exists(bundle_path):
            shutil.rmtree(bundle_path)
        os.makedirs(bundle_path)
        
        # 5. Move/Copy Assets
        # Write XML
        with open(os.path.join(bundle_path, "metadata.xml"), 'w') as f:
            f.write(xml_content)

        # Copy Assets
        for track in processed_tracks:
            filename = track.get("filename")
            if filename:
                src = os.path.join(staging_path, filename)
                dst = os.path.join(bundle_path, filename)
                shutil.copy2(src, dst)

        # Verify Bundle
        files_in_bundle = os.listdir(bundle_path)
        logger.info(f"Bundle created with files: {files_in_bundle}")

        return {
            "status": "PASS",
            "release_id": release_id,
            "bundle_path": bundle_path,
            "details": f"Successfully created ITMSP bundle at {bundle_path} with {len(processed_tracks)} tracks.",
            "delivery_ready": True
        }

    except Exception as e:
        logger.exception("Packaging failed")
        return {"status": "FAIL", "error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: package_itmsp.py <release_id> <staging_path>"}))
        sys.exit(1)

    rid = sys.argv[1]
    spath = sys.argv[2]
    print(json.dumps(package_itmsp(rid, spath), indent=2))
