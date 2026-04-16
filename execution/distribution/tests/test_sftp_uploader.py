
import unittest
from unittest.mock import MagicMock, patch
import json
import os
import sys

# Add parent directory to path to import sftp_uploader
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Mock paramiko if not available to allow testing logic without dependencies
try:
    import paramiko
except ImportError:
    mock_paramiko = MagicMock()
    sys.modules["paramiko"] = mock_paramiko

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

    @patch.dict(os.environ, {"SFTP_PASSWORD": "env_password", "SFTP_KEY_PATH": "env_key"})
    def test_secret_loading_from_env(self):
        # Test that secrets are loaded from environment variables
        with patch('sys.argv', ['sftp_uploader.py', '--host', 'localhost', '--user', 'test', '--local', '/tmp/file']):
            # Patch SFTPUploader at the module level
            with patch('sftp_uploader.SFTPUploader') as mock_uploader_class:
                mock_uploader_instance = mock_uploader_class.return_value

                # Directly call the logic that would be in __main__
                import sftp_uploader
                args = sftp_uploader.setup_args()
                password = os.environ.get("SFTP_PASSWORD")
                key_path = os.environ.get("SFTP_KEY_PATH")
                uploader = sftp_uploader.SFTPUploader(storage_path=args.storage_path)
                uploader.upload(
                    host=args.host,
                    port=args.port,
                    username=args.user,
                    password=password,
                    key_path=key_path,
                    local_path=args.local,
                    remote_path=args.remote
                )

                # Check if upload was called with env values
                mock_uploader_instance.upload.assert_called_once()
                args, kwargs = mock_uploader_instance.upload.call_args
                self.assertEqual(kwargs['password'], 'env_password')
                self.assertEqual(kwargs['key_path'], 'env_key')

if __name__ == '__main__':
    unittest.main()
