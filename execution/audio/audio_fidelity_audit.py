import json
import logging
import os
import subprocess
import sys
from typing import Any, Dict, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("audio_fidelity")

def get_audio_metadata(file_path: str) -> Dict[str, Any]:
    """Extracts technical metadata from audio files using ffprobe.

    Args:
        file_path: Absolute path to the audio file.

    Returns:
        A dictionary containing the parsed JSON output from ffprobe.
    """
    if not os.path.exists(file_path):
        logger.error(f"Fidelity Audit Error: File not found at {file_path}")
        return {"error": "File not found"}

    cmd = [
        "ffprobe", 
        "-v", "quiet", 
        "-print_format", "json", 
        "-show_streams", 
        "-show_format", 
        file_path
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return json.loads(result.stdout)
    except subprocess.CalledProcessError as e:
        logger.error(f"ffprobe failed for {file_path}: {e.stderr}")
        return {"error": f"ffprobe error: {e.stderr}"}
    except Exception as e:
        logger.error(f"Unexpected error getting metadata for {file_path}: {e}")
        return {"error": str(e)}

def audit_fidelity(file_path: str, target: str = "Hi-Res") -> Dict[str, Any]:
    """Audits the technical specifications of an audio file against a target standard.

    Args:
        file_path: Path to the audio file.
        target: The standard to audit against ("CD", "Hi-Res", or "Atmos").

    Returns:
        A detailed audit report.
    """
    metadata = get_audio_metadata(file_path)
    if "error" in metadata:
        return metadata

    try:
        if not metadata.get("streams"):
            return {"error": "No audio streams found in file."}
            
        # Find the first audio stream
        audio_stream = next((s for s in metadata["streams"] if s.get("codec_type") == "audio"), None)
        if not audio_stream:
            return {"error": "No audio stream found."}

        sample_rate = int(audio_stream.get("sample_rate", 0))
        # Handle cases where bit depth might be missing (e.g., lossy files or some containers)
        bit_depth = int(audio_stream.get("bits_per_sample", audio_stream.get("bits_per_raw_sample", 0)))
        channels = int(audio_stream.get("channels", 0))
        format_name = metadata.get("format", {}).get("format_name", "unknown")

        report = {
            "file": os.path.basename(file_path),
            "format": format_name,
            "sample_rate": f"{sample_rate} Hz",
            "bit_depth": f"{bit_depth} bit" if bit_depth > 0 else "unknown",
            "channels": channels,
            "compliance": {
                "CD_Quality": sample_rate >= 44100 and bit_depth >= 16,
                "Hi_Res": sample_rate >= 96000 and bit_depth >= 24,
                "Atmos_Ready": channels >= 6 or (format_name == "asf" and "atmos" in str(metadata).lower())
            },
            "summary_status": "PASS"
        }

        # Compliance Check Logic
        if target.lower() == "hi-res":
            if not report["compliance"]["Hi_Res"]:
                report["summary_status"] = "FAIL (Target: Hi-Res | Current specs do not meet 96kHz/24-bit minimum)"
        elif target.lower() == "atmos":
            if not report["compliance"]["Atmos_Ready"]:
                report["summary_status"] = "FAIL (Target: Atmos | Insufficient channels or incompatible format)"
        elif target.lower() == "cd":
             if not report["compliance"]["CD_Quality"]:
                report["summary_status"] = "FAIL (Target: CD | Current specs do not meet 44.1kHz/16-bit minimum)"

        return report
        
    except (ValueError, KeyError, TypeError) as e:
        logger.error(f"Data parsing error during fidelity audit for {file_path}: {e}")
        return {"error": f"Metadata parsing error: {e}"}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided. Usage: python3 audio_fidelity_audit.py <path> [target]"}))
        sys.exit(1)

    input_path = sys.argv[1]
    target_standard = sys.argv[2] if len(sys.argv) > 2 else "Hi-Res"
    
    results = audit_fidelity(input_path, target_standard)
    print(json.dumps(results, indent=2))
