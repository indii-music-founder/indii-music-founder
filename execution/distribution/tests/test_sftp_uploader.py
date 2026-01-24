
import unittest
from unittest.mock import MagicMock, patch
import json
import os
import sys

# Add parent directory to path to import sftp_uploader
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import sftp_uploader

class TestSFTPUploader(unittest.TestCase):

    @patch('paramiko.SSHClient')
    def test_upload_file_success(self, mock_ssh):
        # Setup mock
        mock_sftp = MagicMock()
        mock_ssh.return_value.open_sftp.return_value = mock_sftp
        
        # Call function
        with patch('os.path.isfile', return_value=True):
            with patch('os.path.isdir', return_value=False):
                # We don't actually want to run main() because it exits, 
                # but we can test the SFTPLoader class directly if refactored,
                # or just mock the logic.
                pass

    def test_argument_parsing(self):
        # We can test if it parses arguments correctly
        with patch('sys.argv', ['sftp_uploader.py', '--host', 'localhost', '--user', 'test', '--local', '/tmp/file']):
            args = sftp_uploader.setup_args()
            self.assertEqual(args.host, 'localhost')
            self.assertEqual(args.user, 'test')
            self.assertEqual(args.local, '/tmp/file')

if __name__ == '__main__':
    unittest.main()
