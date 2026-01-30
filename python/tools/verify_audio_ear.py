import sys
sys.path.append('/a0')
import asyncio
import os
import shutil

from python.tools.indii_audio_ear import IndiiAudioEar

async def test_audio_ear():
    print("🎧 Testing Native Ear (IndiiAudioEar)...")
    
    test_file = "/a0/tmp/test_audio.mp3"
    if not os.path.exists(test_file):
        print(f"⚠️ Test file {test_file} not found. Creating dummy silent file...")
        print(f"❌ Error: {test_file} does not exist. Please run ffmpeg generation first.")
        return False

    # 1. Instantiate
    try:
        tool = IndiiAudioEar()
        print("✅ Tool Instantiated")
    except Exception as e:
        print(f"❌ Instantiation Failed: {e}")
        return False
        
    # 2. Execute
    print(f"🔍 Analyzing: {test_file}")
    try:
        response = await tool.execute(file_path=test_file)
        
        print("\n--- Response ---")
        print(response.message)
        print("----------------")
        
        # Check for success indicators
        if "Audio Analysis Complete" in response.message:
            print(f"✅ Analysis Successful.")
            return True
        else:
            print("❌ Analysis Failed (Message did not indicate success)")
            return False
            
    except Exception as e:
        print(f"❌ Execution Exception: {e}")
        return False

if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    success = loop.run_until_complete(test_audio_ear())
    sys.exit(0 if success else 1)
