import json
import logging
import os
import sys
from typing import Any, Dict

import numpy as np

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("audio_forensics")

# Try to import librosa for advanced analysis
try:
    import librosa
except ImportError:
    logger.warning(
        "librosa not installed. Spectral analysis will be disabled.")
    librosa = None


def detect_spectral_cutoff(file_path: str) -> Dict[str, Any]:
    """Detects if an audio file has a spectral cutoff around 16-20kHz.

    A sharp cutoff at these frequencies often indicates an upsampled
    low-bitrate MP3 or lossy source disguised as high-quality audio.

    Args:
        file_path: Path to the audio file.

    Returns:
        A dictionary containing the status, energy levels, and details.
    """
    if not librosa:
        return {"status": "SKIPPED", "details": "librosa not installed"}

    try:
        # Load audio with original sample rate
        y, sr = librosa.load(file_path, sr=None)

        # Short-Time Fourier Transform
        S = np.abs(librosa.stft(y))
        freqs = librosa.fft_frequencies(sr=sr)

        # Calculate mean energy per frequency bin
        mean_energy = np.mean(S, axis=1)

        # Threshold for 'silence' in high frequencies
        # If energy drops significantly above 16kHz, it's likely upsampled
        cutoff_threshold = 0.0001
        high_freq_indices = np.where(freqs > 16000)[0]

        if len(high_freq_indices) == 0:
            return {
                "status": "PASS",
                "details": f"Sample rate ({sr}Hz) below 32kHz, no high-freq check possible"}

        high_energy = float(np.mean(mean_energy[high_freq_indices]))

        if high_energy < cutoff_threshold:
            return {
                "status": "FAIL (Likely Upsampled)",
                "details": (
                    f"Mean energy above 16kHz is {high_energy:.6f}, "
                    f"which is below the threshold of {cutoff_threshold}"
                )
            }

        return {
            "status": "PASS",
            "high_freq_energy": high_energy,
            "details": (
                "Healthy energy levels detected in high-frequency "
                "range (>16kHz)."
            )
        }
    except Exception as e:
        logger.error(f"Error during spectral analysis of {file_path}: {e}")
        return {"status": "ERROR", "details": str(e)}


def detect_clipping(file_path: str, threshold: float = 0.99) -> Dict[str, Any]:
    """Detects digital clipping (samples reaching peak amplitude).

    Args:
        file_path: Path to the audio file.
        threshold: The amplitude threshold to consider as clipping (default 0.99).

    Returns:
        A dictionary containing the clipping status and percentage.
    """
    if not librosa:
        return {"status": "SKIPPED", "details": "librosa not installed"}

    try:
        y, _ = librosa.load(file_path, sr=None)
        peaks = np.abs(y)
        clipped_samples = np.where(peaks >= threshold)[0]
        clipping_percentage = (len(clipped_samples) / len(y)) * 100

        if clipping_percentage > 0.01:  # More than 0.01% samples clipped
            return {
                "status": "WARNING (Clipping Detected)",
                "clipping_percentage": f"{clipping_percentage:.4f}%",
                "details": (
                    f"Found {len(clipped_samples)} clipped samples. "
                    "Audio may be distorted."
                )
            }

        return {
            "status": "PASS",
            "clipping_percentage": f"{clipping_percentage:.4f}%",
            "details": "No significant clipping detected."
        }
    except Exception as e:
        logger.error(f"Error during clipping detection of {file_path}: {e}")
        return {"status": "ERROR", "details": str(e)}


def detect_silence(file_path: str, top_db: int = 60) -> Dict[str, Any]:
    """Detects leading and trailing silence.

    Args:
        file_path: Path to the audio file.
        top_db: The threshold (in decibels) below reference to consider as silence.

    Returns:
        A dictionary containing silence durations.
    """
    if not librosa:
        return {"status": "SKIPPED", "details": "librosa not installed"}

    try:
        y, sr = librosa.load(file_path, sr=None)
        duration = librosa.get_duration(y=y, sr=sr)

        # Trim silence
        yt, index = librosa.effects.trim(y, top_db=top_db)

        start_silence = index[0] / sr
        end_silence = (len(y) - index[1]) / sr
        trimmed_duration = librosa.get_duration(y=yt, sr=sr)

        return {
            "status": "PASS",
            "original_duration": duration,
            "trimmed_duration": trimmed_duration,
            "leading_silence": start_silence,
            "trailing_silence": end_silence,
            "details": (
                f"Detected {start_silence:.2f}s leading and "
                f"{end_silence:.2f}s trailing silence."
            )
        }
    except Exception as e:
        logger.error(f"Error during silence detection of {file_path}: {e}")
        return {"status": "ERROR", "details": str(e)}


def audit_audio(file_path: str) -> Dict[str, Any]:
    """Performs a comprehensive forensic audit on an audio file.

    Args:
        file_path: Path to the audio file.

    Returns:
        A comprehensive report dictionary.
    """
    logger.info(f"Starting forensic audit for: {file_path}")

    if not os.path.exists(file_path):
        return {"error": f"File not found: {file_path}"}

    forensics: Dict[str, Any] = {}

    # 1. Spectral Check
    forensics["spectral"] = detect_spectral_cutoff(file_path)

    # 2. Clipping Check
    forensics["clipping"] = detect_clipping(file_path)

    # 3. Silence Check
    forensics["silence"] = detect_silence(file_path)

    # Determine summary status
    summary_status = "PASS"
    forensic_results = forensics.values()
    if any("FAIL" in str(r.get("status", "")) for r in forensic_results):
        summary_status = "FAIL (Audio Quality Fraud Detected)"
    elif any("WARNING" in str(r.get("status", "")) for r in forensic_results):
        summary_status = "WARNING (Quality Issues Detected)"

    report = {
        "file": os.path.basename(file_path),
        "timestamp": os.path.getmtime(file_path),
        "forensics": forensics,
        "summary_status": summary_status
    }

    return report


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps(
            {"error": "No file path provided. Usage: python3 audio_forensics.py <path>"}))
        sys.exit(1)

    input_path = sys.argv[1]
    results = audit_audio(input_path)
    print(json.dumps(results, indent=2))
