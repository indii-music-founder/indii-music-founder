import json
import sys
import subprocess
import os

def get_audio_metadata(file_path):
    """
    Uses ffprobe to extract technical metadata from audio files.
    """
    if not os.path.exists(file_path):
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
        result = subprocess.run(cmd, capture_output=True, text=True)
        return json.loads(result.stdout)
    except Exception as e:
        return {"error": str(e)}

def audit_fidelity(file_path, target="Hi-Res"):
    metadata = get_audio_metadata(file_path)
    if "error" in metadata:
        return metadata

    stream = metadata["streams"][0]
    sample_rate = int(stream.get("sample_rate", 0))
    bit_depth = int(stream.get("bits_per_sample", stream.get("bits_per_raw_sample", 0)))
    channels = int(stream.get("channels", 0))

    report = {
        "file": os.path.basename(file_path),
        "sample_rate": sample_rate,
        "bit_depth": bit_depth,
        "channels": channels,
        "compliance": {
            "CD_Quality": sample_rate >= 44100 and bit_depth >= 16,
            "Hi_Res": sample_rate >= 96000 and bit_depth >= 24,
            "Atmos_Ready": channels >= 6 # Minimum 5.1/7.1 for ADM BWF files
        },
        "status": "PASS"
    }

    if target == "Hi-Res" and not report["compliance"]["Hi_Res"]:
        report["status"] = "FAIL (Insufficient Bit Depth/Sample Rate)"
    elif target == "Atmos" and not report["compliance"]["Atmos_Ready"]:
        report["status"] = "FAIL (Insufficient Channels for Atmos BWF)"

    return report

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        sys.exit(1)

    path = sys.argv[1]
    target = sys.argv[2] if len(sys.argv) > 2 else "Hi-Res"
    print(json.dumps(audit_fidelity(path, target), indent=2))
