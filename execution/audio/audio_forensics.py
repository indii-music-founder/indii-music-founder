import json
import sys
import os
import subprocess
import numpy as np

# librosa is a common dependency for audio analysis
try:
    import librosa
except ImportError:
    librosa = None

def detect_spectral_cutoff(file_path):
    """
    Detects if an audio file has a spectral cutoff around 16-20kHz, 
    which often indicates an upsampled low-bitrate MP3.
    """
    if not librosa:
        return {"warning": "librosa not installed, skipping spectral check"}

    try:
        y, sr = librosa.load(file_path, sr=None)
        S = np.abs(librosa.stft(y))
        # Find frequency bins
        freqs = librosa.fft_frequencies(sr=sr)
        
        # Calculate mean energy per frequency bin
        mean_energy = np.mean(S, axis=1)
        
        # Threshold for 'silence' in high frequencies
        # If energy drops significantly above 16kHz, it's likely upsampled
        cutoff_threshold = 0.0001
        high_freq_indices = np.where(freqs > 16000)[0]
        
        if len(high_freq_indices) == 0:
            return {"status": "PASS", "details": "Sample rate below 32kHz, no high-freq check possible"}

        high_energy = np.mean(mean_energy[high_freq_indices])
        
        if high_energy < cutoff_threshold:
            return {
                "status": "FAIL (Likely Upsampled)", 
                "details": f"Mean energy above 16kHz is {high_energy:.6f}, below threshold {cutoff_threshold}"
            }
        
        return {"status": "PASS", "high_freq_energy": float(high_energy)}
    except Exception as e:
        return {"error": str(e)}

def audit_audio(file_path):
    report = {
        "file": os.path.basename(file_path),
        "forensics": {},
        "status": "PASS"
    }
    
    # 1. Spectral Check
    report["forensics"]["spectral"] = detect_spectral_cutoff(file_path)
    if report["forensics"]["spectral"].get("status") and "FAIL" in report["forensics"]["spectral"]["status"]:
        report["status"] = "FAIL (Audio Quality Fraud Detected)"

    return report

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        sys.exit(1)

    path = sys.argv[1]
    print(json.dumps(audit_audio(path), indent=2))
