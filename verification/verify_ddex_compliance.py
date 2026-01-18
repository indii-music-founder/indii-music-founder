#!/usr/bin/env python3
import sys
import os
import xml.etree.ElementTree as ET
import json
import logging

# Add execution directories to sys.path
BASE_DIR = os.getcwd()
sys.path.append(os.path.join(BASE_DIR, 'execution', 'distribution'))

try:
    from ddex_generator import DDEXGenerator
except ImportError:
    print("FAIL: Could not import DDEXGenerator. Check paths.")
    sys.exit(1)

def verify_ddex_compliance():
    """
    Verifies that the DDEXGenerator produces valid XML with respect to specific constraints:
    1. No duplicate FileName elements.
    2. FileName precedes HashSum.
    """
    print("Running DDEX Compliance Verification...")

    generator = DDEXGenerator()
    track_data = {
        "title": "Compliance Test Track",
        "isrc": "USCMP2300001",
        "duration": 180,
        "filename": "compliance_track.flac",
        "file_hash": "a1b2c3d4e5f67890"
    }
    release_data = {
        "upc": "1234567890123",
        "tracks": [track_data],
        "album_title": "Compliance Test Album",
        "artist": "Compliance Artist",
        "label": "Compliance Records"
    }

    try:
        xml_output = generator.generate_ern(release_data)
        root = ET.fromstring(xml_output)
        ns = {'ern': 'http://ddex.net/xml/ern/43'}

        # Traverse to find File elements
        # SoundRecording -> SoundRecordingDetailsByTerritory -> TechnicalSoundRecordingDetails -> File

        sound_recordings = root.findall(".//ern:SoundRecording", ns)
        if not sound_recordings:
            print("FAIL: No SoundRecording elements generated.")
            sys.exit(1)

        for sr in sound_recordings:
            details_list = sr.find("ern:SoundRecordingDetailsByTerritory", ns)
            if details_list is None:
                print("FAIL: No SoundRecordingDetailsByTerritory found.")
                sys.exit(1)

            tech_details = details_list.find("ern:TechnicalSoundRecordingDetails", ns)
            if tech_details is None:
                print("FAIL: No TechnicalSoundRecordingDetails found.")
                sys.exit(1)

            file_elem = tech_details.find("ern:File", ns)
            if file_elem is None:
                print("FAIL: No File element found.")
                sys.exit(1)

            # Check 1: No duplicate FileName
            file_names = file_elem.findall("ern:FileName", ns)
            if len(file_names) > 1:
                print(f"FAIL: Duplicate FileName elements found ({len(file_names)}).")
                for fn in file_names:
                    print(f"  - {fn.text}")
                sys.exit(1)
            elif len(file_names) == 0:
                 print("FAIL: No FileName element found.")
                 sys.exit(1)

            print(f"PASS: Single FileName found: {file_names[0].text}")

            # Check 2: Order of elements (FileName before HashSum)
            # ElementTree stores children in order
            children = list(file_elem)
            tags = [child.tag.replace(f"{{{ns['ern']}}}", "") for child in children]

            if "FileName" not in tags or "HashSum" not in tags:
                print(f"FAIL: FileName or HashSum missing in tags: {tags}")
                sys.exit(1)

            idx_filename = tags.index("FileName")
            idx_hashsum = tags.index("HashSum")

            if idx_filename > idx_hashsum:
                print(f"FAIL: FileName appears AFTER HashSum. Order: {tags}")
                sys.exit(1)

            print(f"PASS: Element order correct (FileName index {idx_filename} < HashSum index {idx_hashsum}).")

        print("\nDDEX Compliance Verification Passed.")
        return True

    except Exception as e:
        print(f"FAIL: Exception during verification: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    verify_ddex_compliance()
