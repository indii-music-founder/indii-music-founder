import unittest
import sys
import os
import xml.etree.ElementTree as ET

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.getcwd())

try:
    from ddex_generator import DDEXGenerator
except ImportError:
    from execution.distribution.ddex_generator import DDEXGenerator

class TestDDEXStructure(unittest.TestCase):
    def setUp(self):
        self.generator = DDEXGenerator()
        self.root = ET.Element("Root")
        self.track = {
            "title": "Test Track",
            "isrc": "US1234567890",
            "duration": 180,
            "filename": "test_audio.flac",
            "file_hash": "d41d8cd98f00b204e9800998ecf8427e"
        }

    def test_filename_duplication_and_order(self):
        """
        Verify that FileName element appears exactly once and precedes HashSum.
        """
        sr = self.generator.generate_sound_recording(self.root, self.track, 1)

        # Traverse to File element
        details_list = sr.find("SoundRecordingDetailsByTerritory")
        self.assertIsNotNone(details_list, "SoundRecordingDetailsByTerritory not found")

        tech_details = details_list.find("TechnicalSoundRecordingDetails")
        self.assertIsNotNone(tech_details, "TechnicalSoundRecordingDetails not found")

        file_elem = tech_details.find("File")
        self.assertIsNotNone(file_elem, "File element not found")

        # Check FileName count
        filenames = file_elem.findall("FileName")
        self.assertEqual(len(filenames), 1, f"Expected 1 FileName element, found {len(filenames)}")
        self.assertEqual(filenames[0].text, "test_audio.flac")

        # Check Order: FileName must precede HashSum
        children = list(file_elem)
        tags = [child.tag for child in children]

        self.assertIn("FileName", tags)
        self.assertIn("HashSum", tags)

        fn_idx = tags.index("FileName")
        hs_idx = tags.index("HashSum")

        self.assertLess(fn_idx, hs_idx, "FileName must precede HashSum")

if __name__ == "__main__":
    unittest.main()
