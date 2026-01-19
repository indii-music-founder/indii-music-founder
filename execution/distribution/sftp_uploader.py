import argparse
import json
import logging
import os
import sys
import paramiko
from typing import Dict, Any, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("sftp_uploader")

class SFTPUploader:
    """Manages the transmission of DDEX packages and ITMSP bundles via SFTP."""

    def __init__(self, storage_path: Optional[str] = None):
        self.storage_path = storage_path
        if storage_path:
            os.makedirs(storage_path, exist_ok=True)
            self.log_file = os.path.join(storage_path, "sftp_transfer.log")
            file_handler = logging.FileHandler(self.log_file)
            file_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
            logger.addHandler(file_handler)

    def upload(self, 
               host: str, 
               port: int, 
               username: str, 
               password: Optional[str] = None, 
               key_path: Optional[str] = None,
               local_path: str = "", 
               remote_path: str = "") -> Dict[str, Any]:
        """
        Uploads a file or directory to a remote SFTP server.
        """
        logger.info(f"Initiating SFTP upload to {host}:{port} for {local_path}")
        
        try:
            if not os.path.exists(local_path):
                return {"status": "FAIL", "error": f"Local path {local_path} does not exist"}

            transport = paramiko.Transport((host, port))
            
            if key_path:
                # Try multiple key types
                pkey = None
                errors = []
                for key_class in [paramiko.Ed25519Key, paramiko.RSAKey, paramiko.ECDSAKey, paramiko.DSSKey]:
                    try:
                        pkey = key_class.from_private_key_file(key_path)
                        break
                    except Exception as e:
                        errors.append(f"{key_class.__name__}: {str(e)}")
                
                if not pkey:
                    return {"status": "FAIL", "error": f"Failed to load private key. Errors: {'; '.join(errors)}"}
                
                transport.connect(username=username, pkey=pkey)
            else:
                transport.connect(username=username, password=password)

            sftp = paramiko.SFTPClient.from_transport(transport)
            
            # Progress callback
            def progress_callback(transferred, total):
                if total > 0:
                    percent = (transferred / total) * 100
                    if transferred % (1024 * 1024) == 0 or transferred == total: # Log every MB or at completion
                        logger.info(f"PROGRESS:{percent:.2f}")

            if os.path.isfile(local_path):
                filename = os.path.basename(local_path)
                target = os.path.join(remote_path, filename).replace('\\', '/')
                logger.info(f"Uploading file {local_path} to {target}")
                sftp.put(local_path, target, callback=progress_callback)
            
            elif os.path.isdir(local_path):
                # Ensure remote directory exists
                try:
                    sftp.mkdir(remote_path)
                except IOError:
                    pass # Directory might already exist
                
                for root, dirs, files in os.walk(local_path):
                    for name in files:
                        local_file = os.path.join(root, name)
                        # Calculate relative path for remote
                        rel_path = os.path.relpath(local_file, local_path)
                        remote_file = os.path.join(remote_path, rel_path).replace('\\', '/')
                        
                        # Ensure subdirectories exist on remote
                        remote_dir = os.path.dirname(remote_file)
                        self._mkdir_recursive(sftp, remote_dir)
                        
                        logger.info(f"Uploading {local_file} -> {remote_file}")
                        sftp.put(local_file, remote_file, callback=progress_callback)

            sftp.close()
            transport.close()
            
            logger.info("SFTP Upload Successful")
            return {
                "status": "SUCCESS",
                "message": f"Successfully uploaded {local_path} to {host}",
                "host": host,
                "remote_path": remote_path
            }

        except Exception as e:
            logger.exception("SFTP Upload Failed")
            return {"status": "FAIL", "error": str(e)}

    def _mkdir_recursive(self, sftp, remote_directory):
        """Recursively create directories on the remote server."""
        if remote_directory == "" or remote_directory == "/":
            return
        try:
            sftp.stat(remote_directory)
        except IOError:
            self._mkdir_recursive(sftp, os.path.dirname(remote_directory))
            sftp.mkdir(remote_directory)

def setup_args():
    parser = argparse.ArgumentParser(description="IndiiOS SFTP Transmission Engine")
    parser.add_argument("--host", required=True, help="SFTP Host")
    parser.add_argument("--port", type=int, default=22, help="SFTP Port")
    parser.add_argument("--user", required=True, help="SFTP Username")
    parser.add_argument("--password", help="SFTP Password")
    parser.add_argument("--key", help="Path to Private Key file")
    parser.add_argument("--local", required=True, help="Local file or directory to upload")
    parser.add_argument("--remote", default=".", help="Remote directory path")
    parser.add_argument("--storage-path", help="Path for logs and session data")
    return parser.parse_args()

if __name__ == "__main__":
    args = setup_args()

    # Security: Prioritize Environment Variables
    password = os.environ.get("SFTP_PASSWORD", args.password)
    key_path = os.environ.get("SFTP_KEY_PATH", args.key)
    # Prioritize environment variables for secrets if arguments are not provided
    password = args.password or os.environ.get("SFTP_PASSWORD")
    key_path = args.key or os.environ.get("SFTP_KEY")

    uploader = SFTPUploader(storage_path=args.storage_path)
    result = uploader.upload(
        host=args.host,
        port=args.port,
        username=args.user,
        password=password,
        key_path=key_path,
        local_path=args.local,
        remote_path=args.remote
    )
    
    print(json.dumps(result, indent=2))
