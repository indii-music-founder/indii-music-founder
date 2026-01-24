import unittest
import json
import os
import sys
import shutil
import tempfile
from unittest.mock import patch, MagicMock

# Add parent directory to path to import local module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from isrc_manager import IdentityManager

class TestIdentityManager(unittest.TestCase):

    def setUp(self):
        # Create a temporary directory for the test data store
        self.test_dir = tempfile.mkdtemp()
        self.store_path = os.path.join(self.test_dir, "test_identity_store.json")
        self.manager = IdentityManager(store_path=self.store_path)

    def tearDown(self):
        # Cleanup temporary directory
        shutil.rmtree(self.test_dir)

    def test_initialization(self):
        self.assertEqual(self.manager.data["isrc_count"], 0)
        self.assertEqual(self.manager.data["upc_count"], 0)

    def test_generate_isrc_format(self):
        isrc = self.manager.generate_isrc(country="US", registrant="ABC")
        # Format: CC-XXX-YY-NNNNN
        parts = isrc.split('-')
        self.assertEqual(len(parts), 4)
        self.assertEqual(parts[0], "US")
        self.assertEqual(parts[1], "ABC")
        self.assertTrue(parts[2].isdigit() and len(parts[2]) == 2) # YY
        self.assertTrue(parts[3].isdigit() and len(parts[3]) == 5) # NNNNN

    def test_generate_isrc_increment(self):
        isrc1 = self.manager.generate_isrc()
        isrc2 = self.manager.generate_isrc()
        seq1 = int(isrc1.split('-')[-1])
        seq2 = int(isrc2.split('-')[-1])
        self.assertEqual(seq2, seq1 + 1)

    def test_calculate_upc_check_digit(self):
        # Known valid UPC: 03600029145 2 (Huggies)
        # Using 03600029145 to calc check digit
        digit = self.manager._calculate_upc_check_digit("03600029145")
        self.assertEqual(digit, 2)

        # Another known UPC: 01234567890 5
        digit = self.manager._calculate_upc_check_digit("01234567890")
        self.assertEqual(digit, 5)

    def test_generate_upc_format(self):
        upc = self.manager.generate_upc()
        self.assertEqual(len(upc), 12)
        self.assertTrue(upc.isdigit())

    def test_persistence(self):
        # Generate some IDs
        self.manager.generate_isrc()
        self.manager._save_data()

        # Reload manager from same store
        new_manager = IdentityManager(store_path=self.store_path)
        self.assertEqual(new_manager.data["isrc_count"], 1)

    def test_register_release(self):
        metadata = {
            "title": "Album 1",
            "tracks": [{"title": "Track 1"}, {"title": "Track 2"}]
        }
        rid = "REL-TEST-001"
        
        result = self.manager.register_release(rid, metadata)
        
        self.assertIn("assigned_upc", result)
        self.assertEqual(len(result["tracks"]), 2)
        self.assertIn("assigned_isrc", result["tracks"][0])
        self.assertIn("assigned_isrc", result["tracks"][1])
        
        # Verify it's in the registry
        self.assertIn(rid, self.manager.data["registry"])

if __name__ == '__main__':
    unittest.main()
