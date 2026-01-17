import subprocess
import json
import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def run_script(path, args=[]):
    cmd = ["python3", os.path.join(BASE_DIR, path)] + args
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result

def test_waterfall():
    print("Testing waterfall_payout.py...")
    input_data = json.dumps({
        "gross": 1000,
        "splits": {"artist": 0.5, "label": 0.5},
        "recoupment": 100
    })
    res = run_script("execution/finance/waterfall_payout.py", [input_data])
    if res.returncode == 0:
        data = json.loads(res.stdout)
        assert data["distributions"]["artist"]["amount"] == 375.0 # (1000 - 150 - 100) * 0.5
        print("✅ Waterfall Payout Passed")
    else:
        print(f"❌ Waterfall Payout Failed: {res.stderr}")

def test_qc_validator():
    print("Testing qc_validator.py...")
    input_data = json.dumps({
        "title": "Good Title",
        "artist": "Good Artist",
        "artwork_url": "http://example.com/art.jpg"
    })
    res = run_script("execution/distribution/qc_validator.py", [input_data])
    if res.returncode == 0:
        data = json.loads(res.stdout)
        assert data["valid"] == True
        print("✅ QC Validator Valid Metadata Passed")
    else:
        print(f"❌ QC Validator Failed: {res.stderr}")

    # Test invalid
    input_invalid = json.dumps({"title": "FEAT ARTIST", "artist": "Chill Beats"})
    res = run_script("execution/distribution/qc_validator.py", [input_invalid])
    data = json.loads(res.stdout)
    assert data["valid"] == False
    print("✅ QC Validator Invalid Metadata Passed")

def test_isrc_manager():
    print("Testing isrc_manager.py...")
    res = run_script("execution/distribution/isrc_manager.py", ["generate_isrc"])
    if res.returncode == 0:
        data = json.loads(res.stdout)
        assert "isrc" in data
        print("✅ ISRC Generation Passed")
    else:
        print(f"❌ ISRC Manager Failed: {res.stderr}")

def test_content_id():
    print("Testing content_id_csv_generator.py...")
    input_data = json.dumps({
        "tracks": [{"id": "1", "title": "Song 1", "isrc": "US-XXX-23-00001"}],
        "upc": "123456789012",
        "artist": "Test Artist"
    })
    res = run_script("execution/distribution/content_id_csv_generator.py", [input_data])
    if res.returncode == 0:
        assert "sound_recording" in res.stdout
        assert "US-XXX-23-00001" in res.stdout
        print("✅ Content ID CSV Generation Passed")
    else:
        print(f"❌ Content ID Generator Failed: {res.stderr}")

if __name__ == "__main__":
    print("\n" + "="*60)
    print(" EXECUTING GLOBAL SCRIPT VERIFICATION ")
    print("="*60)
    test_waterfall()
    test_qc_validator()
    test_isrc_manager()
    test_content_id()
    print("="*60 + "\n")
