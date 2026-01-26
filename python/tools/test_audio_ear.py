import asyncio
import os
import sys

# Add project root to path
sys.path.append(os.getcwd())

from python.tools.indii_audio_ear import IndiiAudioEar

async def test_audio():
    tool = IndiiAudioEar()
    # Check if sample file exists
    sample_file = "sample-6s.mp3"
    if not os.path.exists(sample_file):
        print(f"Sample file {sample_file} not found in root.")
        return

    print(f"Running IndiiAudioEar on {sample_file}...")
    response = await tool.execute(file_path=os.path.abspath(sample_file))
    print(response.message)
    if "additional" in response.__dict__:
        print(f"Metadata Path: {response.additional.get('metadata_path')}")

if __name__ == "__main__":
    asyncio.run(test_audio())
