
import argparse
import json
import logging
import os
import subprocess
from typing import Dict, Any, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("aspera_uploader")

class AsperaUploader:
    """Manages the transmission of packages via IBM Aspera Connect (fasp)."""

    def __init__(self, storage_path: Optional[str] = None):
        self.storage_path = storage_path
        if storage_path:
            os.makedirs(storage_path, exist_ok=True)
            self.log_file = os.path.join(storage_path, "aspera_transfer.log")
            file_handler = logging.FileHandler(self.log_file)
            file_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
            logger.addHandler(file_handler)

    def _find_ascp(self) -> Optional[str]:
        """Attempts to locate the ascp binary."""
        # 1. Check PATH
        try:
            subprocess.run(["ascp", "--version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
            return "ascp"
        except FileNotFoundError:
            pass

        # 2. Check common installation paths (macOS)
        mac_paths = [
            os.path.expanduser("~/Applications/Aspera Connect.app/Contents/Resources/ascp"),
            "/Applications/Aspera Connect.app/Contents/Resources/ascp",
            os.path.expanduser("~/Library/Application Support/Aspera/Aspera Connect/bin/ascp")
        ]
        for p in mac_paths:
            if os.path.exists(p):
                return p
        
        return None

    def upload(self, 
               host: str, 
               username: str, 
               port: int = 33001,
               password: Optional[str] = None, 
               key_path: Optional[str] = None,
               local_path: str = "", 
               remote_path: str = "",
               target_rate: str = "100M") -> Dict[str, Any]:
        """
        Uploads using ascp command line.
        """
        logger.info(f"Initiating Aspera upload to {host} for {local_path}")
        
        try:
            if not os.path.exists(local_path):
                return {"status": "FAIL", "error": f"Local path {local_path} does not exist"}

            ascp_path = self._find_ascp()

            if not ascp_path:
                logger.warning("ascp binary not found")
                return {
                    "status": "FAIL",
                    "error": "Aspera (ascp) binary not found on system. Please install Aspera Connect."
                }

            # Build ascp command
            # -l: target rate, -P: SSH port (33001), -O: UDP port (33001)
            # -Q: adaptive rate control, -k 1: resume
            cmd = [
                ascp_path,
                "-P", str(port),
                "-O", str(port),
                "-l", target_rate,
                "-Q", "-k", "1"
            ]

            if key_path:
                cmd.extend(["-i", key_path])
            
            # Destination format: user@host:path
            remote_spec = f"{username}@{host}:{remote_path}"
            cmd.append(local_path)
            cmd.append(remote_spec)

            logger.info(f"Executing: {' '.join(cmd)}")
            
            # Handle password if provided via env var (ascp standard)
            env = os.environ.copy()
            if password:
                env["ASPERA_SCP_PASS"] = password

            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                env=env
            )

            full_output = []
            for line in process.stdout:
                line = line.strip()
                if line:
                    logger.info(f"[ascp] {line}")
                    full_output.append(line)
                    
                    # Extract progress (e.g., " 25% ")
                    import re
                    match = re.search(r"(\d+)%", line)
                    if match:
                        logger.info(f"PROGRESS:{match.group(1)}")

            process.wait()

            if process.returncode == 0:
                return {
                    "status": "SUCCESS",
                    "message": f"Aspera transmission complete for {local_path}",
                    "output": "\n".join(full_output[-10:])
                }
            else:
                return {
                    "status": "FAIL",
                    "error": f"ascp exited with code {process.returncode}",
                    "output": "\n".join(full_output)
                }

        except Exception as e:
            logger.exception("Aspera Upload Failed")
            return {"status": "FAIL", "error": str(e)}

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="IndiiOS Aspera Transmission Engine")
    parser.add_argument("--host", required=True, help="Aspera Host")
    parser.add_argument("--port", type=int, default=33001, help="Aspera Port")
    parser.add_argument("--user", required=True, help="Aspera Username")
    parser.add_argument("--password", help="Aspera Password")
    parser.add_argument("--key", help="Path to Private Key file")
    parser.add_argument("--local", required=True, help="Local file or directory to upload")
    parser.add_argument("--remote", default=".", help="Remote directory path")
    parser.add_argument("--rate", default="100M", help="Target transfer rate (e.g., 100M)")
    parser.add_argument("--storage-path", help="Path for logs and session data")

    args = parser.parse_args()

    uploader = AsperaUploader(storage_path=args.storage_path)
    result = uploader.upload(
        host=args.host,
        port=args.port,
        username=args.user,
        password=args.password,
        key_path=args.key,
        local_path=args.local,
        remote_path=args.remote,
        target_rate=args.rate
    )
    
    print(json.dumps(result, indent=2))
