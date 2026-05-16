import argparse
import json
import os

def validate_format(file_name, sample_rate, bit_depth):
    # DSP Standard Requirements
    # - Sample Rate: 44.1kHz or 48kHz
    # - Bit Depth: 16-bit or 24-bit
    # - Format: WAV, FLAC, or AIFF
    
    extension = os.path.splitext(file_name)[1].lower()
    valid_extensions = [".wav", ".flac", ".aiff"]
    
    is_valid = True
    errors = []
    
    if extension not in valid_extensions:
        is_valid = False
        errors.append(f"Invalid format: {extension}. Use WAV, FLAC, or AIFF.")
        
    if sample_rate not in [44100, 48000, 88200, 96000]:
        is_valid = False
        errors.append(f"Non-standard sample rate: {sample_rate}Hz.")
        
    if bit_depth not in [16, 24, 32]:
        is_valid = False
        errors.append(f"Non-standard bit depth: {bit_depth}-bit.")
        
    return {
        "is_valid": is_valid,
        "file": file_name,
        "errors": errors,
        "recommendation": "Ready for Distribution" if is_valid else "Correction Required"
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Validate audio file format for DSP distribution.")
    parser.add_argument("--file", type=str, required=True)
    parser.add_argument("--sample_rate", type=int, required=True)
    parser.add_argument("--bit_depth", type=int, required=True)
    args = parser.parse_args()
    
    result = validate_format(args.file, args.sample_rate, args.bit_depth)
    print(json.dumps(result, indent=2))
