import asyncio
import time
from python.tools.split_sheet_generator import SplitSheetGenerator
import os

async def main():
    # Provide dummy values to skip google genai logic if possible or just test the request
    tool = SplitSheetGenerator()
    start_time = time.time()

    # Actually wait, we should mock the google genai call, and requests.post to simulate latency
    pass

if __name__ == "__main__":
    asyncio.run(main())
