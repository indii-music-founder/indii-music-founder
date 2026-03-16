#!/usr/bin/env python3
"""
deliver_apple.py - Apple Music Delivery via Transporter

Wraps Apple's iTunes Transporter CLI tool for automated delivery of
.itmsp bundles to Apple Music / iTunes Store.

Apple Transporter is available:
  - macOS: /Applications/Transporter.app/Contents/itms/bin/iTMSTransporter
  - Via Xcode: xcrun iTMSTransporter
  - Standalone download from Apple Developer portal

Required credentials (environment variables):
  - APPLE_PROVIDER_ID: Your Apple Music content provider ID
  - APPLE_TRANSPORTER_USER: Apple ID email for delivery
  - APPLE_TRANSPORTER_PASSWORD: App-specific password (generate at appleid.apple.com)

Usage:
  python deliver_apple.py upload /path/to/RELEASE-001.itmsp
  python deliver_apple.py verify /path/to/RELEASE-001.itmsp
  python deliver_apple.py status --vendor-id RELEASE-001
"""

import argparse
import json
import logging
import os
import subprocess
import sys
from typing import Any, Dict, List, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("deliver_apple")


class AppleTransporter:
    """Manages delivery of ITMSP bundles to Apple Music via Transporter CLI."""

    # Common Transporter binary locations on macOS
    TRANSPORTER_PATHS = [
        "/Applications/Transporter.app/Contents/itms/bin/iTMSTransporter",
        os.path.expanduser("~/Applications/Transporter.app/Contents/itms/bin/iTMSTransporter"),
        "/usr/local/itms/bin/iTMSTransporter",
    ]

    def __init__(self,
                 apple_id: Optional[str] = None,
                 password: Optional[str] = None,
                 provider_id: Optional[str] = None):
        """Initialize with Apple credentials.

        Args:
            apple_id: Apple ID email. Defaults to APPLE_TRANSPORTER_USER env var.
            password: App-specific password. Defaults to APPLE_TRANSPORTER_PASSWORD env var.
            provider_id: Content provider short name. Defaults to APPLE_PROVIDER_ID env var.
        """
        self.apple_id = apple_id or os.environ.get("APPLE_TRANSPORTER_USER", "")
        self.password = password or os.environ.get("APPLE_TRANSPORTER_PASSWORD", "")
        self.provider_id = provider_id or os.environ.get("APPLE_PROVIDER_ID", "")

    def _find_transporter(self) -> Optional[str]:
        """Locate the iTMSTransporter binary on the system."""
        # Check if available via xcrun
        try:
            result = subprocess.run(
                ["xcrun", "--find", "iTMSTransporter"],
                capture_output=True, text=True, check=False
            )
            if result.returncode == 0 and result.stdout.strip():
                path = result.stdout.strip()
                if os.path.exists(path):
                    return path
        except FileNotFoundError:
            pass

        # Check common installation paths
        for path in self.TRANSPORTER_PATHS:
            if os.path.exists(path):
                return path

        # Check if it's in PATH
        try:
            result = subprocess.run(
                ["which", "iTMSTransporter"],
                capture_output=True, text=True, check=False
            )
            if result.returncode == 0 and result.stdout.strip():
                return result.stdout.strip()
        except FileNotFoundError:
            pass

        return None

    def _validate_credentials(self) -> Optional[str]:
        """Validate that required credentials are configured."""
        if not self.apple_id:
            return (
                "Apple ID not configured. Set APPLE_TRANSPORTER_USER environment variable "
                "to your Apple ID email address."
            )
        if not self.password:
            return (
                "App-specific password not configured. Set APPLE_TRANSPORTER_PASSWORD "
                "environment variable. Generate one at https://appleid.apple.com/account/manage"
            )
        return None

    def _run_transporter(self, args: List[str]) -> Dict[str, Any]:
        """Execute a Transporter command and capture output."""
        transporter = self._find_transporter()
        if not transporter:
            return {
                "status": "FAIL",
                "error": (
                    "Apple Transporter (iTMSTransporter) not found. "
                    "Install from: https://apps.apple.com/app/transporter/id1450874784 "
                    "or ensure Xcode command line tools are installed."
                )
            }

        cmd = [transporter] + args
        logger.info(f"Executing: {' '.join(cmd[:3])}... (credentials redacted)")

        try:
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True
            )

            output_lines = []
            for line in process.stdout:
                line = line.strip()
                if line:
                    # Don't log credential-containing lines
                    if "password" not in line.lower() and "@" not in line:
                        logger.info(f"[Transporter] {line}")
                    output_lines.append(line)

            process.wait()

            success = process.returncode == 0
            return {
                "status": "SUCCESS" if success else "FAIL",
                "exit_code": process.returncode,
                "output": "\n".join(output_lines[-20:]),  # Last 20 lines
                "full_output_lines": len(output_lines)
            }

        except Exception as e:
            logger.exception("Transporter execution failed")
            return {"status": "FAIL", "error": str(e)}

    def verify(self, itmsp_path: str) -> Dict[str, Any]:
        """Verify an ITMSP bundle without uploading.

        This validates the package structure, metadata, and assets against
        Apple's requirements before attempting delivery.

        Args:
            itmsp_path: Path to the .itmsp directory.

        Returns:
            Report dict with validation status and details.
        """
        logger.info(f"Verifying ITMSP bundle: {itmsp_path}")

        if not os.path.exists(itmsp_path):
            return {"status": "FAIL", "error": f"Bundle path does not exist: {itmsp_path}"}

        if not itmsp_path.endswith(".itmsp"):
            return {"status": "FAIL", "error": "Path must end with .itmsp"}

        cred_error = self._validate_credentials()
        if cred_error:
            return {"status": "FAIL", "error": cred_error}

        args = [
            "-m", "verify",
            "-u", self.apple_id,
            "-p", self.password,
            "-f", itmsp_path,
            "-v", "informational"  # Verbosity: critical, error, warning, informational, detailed
        ]

        if self.provider_id:
            args.extend(["-itc_provider", self.provider_id])

        result = self._run_transporter(args)
        result["action"] = "verify"
        result["bundle_path"] = itmsp_path
        return result

    def upload(self, itmsp_path: str) -> Dict[str, Any]:
        """Upload an ITMSP bundle to Apple Music.

        This delivers the package to Apple's ingestion pipeline. Successful
        upload means Apple has received the content — it will then go through
        their review and processing pipeline.

        Args:
            itmsp_path: Path to the .itmsp directory.

        Returns:
            Report dict with delivery status and details.
        """
        logger.info(f"Uploading ITMSP bundle: {itmsp_path}")

        if not os.path.exists(itmsp_path):
            return {"status": "FAIL", "error": f"Bundle path does not exist: {itmsp_path}"}

        if not itmsp_path.endswith(".itmsp"):
            return {"status": "FAIL", "error": "Path must end with .itmsp"}

        cred_error = self._validate_credentials()
        if cred_error:
            return {"status": "FAIL", "error": cred_error}

        args = [
            "-m", "upload",
            "-u", self.apple_id,
            "-p", self.password,
            "-f", itmsp_path,
            "-v", "eXtreme"  # Maximum verbosity for delivery tracking
        ]

        if self.provider_id:
            args.extend(["-itc_provider", self.provider_id])

        result = self._run_transporter(args)
        result["action"] = "upload"
        result["bundle_path"] = itmsp_path
        return result

    def lookup_status(self, vendor_id: str) -> Dict[str, Any]:
        """Check the processing status of a previously delivered release.

        Args:
            vendor_id: The vendor/release ID used during delivery.

        Returns:
            Status report from Apple's processing pipeline.
        """
        logger.info(f"Looking up status for vendor ID: {vendor_id}")

        cred_error = self._validate_credentials()
        if cred_error:
            return {"status": "FAIL", "error": cred_error}

        args = [
            "-m", "lookupMetadata",
            "-u", self.apple_id,
            "-p", self.password,
            "-vendor_id", vendor_id,
            "-v", "informational"
        ]

        if self.provider_id:
            args.extend(["-itc_provider", self.provider_id])

        result = self._run_transporter(args)
        result["action"] = "status_lookup"
        result["vendor_id"] = vendor_id
        return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Apple Music Delivery via Transporter",
        epilog=(
            "Environment variables:\n"
            "  APPLE_TRANSPORTER_USER     - Apple ID email\n"
            "  APPLE_TRANSPORTER_PASSWORD - App-specific password\n"
            "  APPLE_PROVIDER_ID          - Content provider short name\n"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to execute")

    # Upload command
    upload_parser = subparsers.add_parser("upload", help="Upload ITMSP bundle to Apple Music")
    upload_parser.add_argument("itmsp_path", help="Path to .itmsp directory")

    # Verify command
    verify_parser = subparsers.add_parser("verify", help="Verify ITMSP bundle (dry run)")
    verify_parser.add_argument("itmsp_path", help="Path to .itmsp directory")

    # Status command
    status_parser = subparsers.add_parser("status", help="Check delivery status")
    status_parser.add_argument("--vendor-id", required=True, help="Vendor/release ID")

    # Global options
    parser.add_argument("--apple-id", help="Apple ID (overrides env var)")
    parser.add_argument("--password", help="App-specific password (overrides env var)")
    parser.add_argument("--provider-id", help="Provider short name (overrides env var)")
    parser.add_argument("--storage-path", help="Path for logs (unused, for consistency)")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    transporter = AppleTransporter(
        apple_id=args.apple_id,
        password=args.password,
        provider_id=args.provider_id
    )

    if args.command == "upload":
        result = transporter.upload(args.itmsp_path)
    elif args.command == "verify":
        result = transporter.verify(args.itmsp_path)
    elif args.command == "status":
        result = transporter.lookup_status(args.vendor_id)
    else:
        result = {"error": f"Unknown command: {args.command}"}

    print(json.dumps(result, indent=2))
