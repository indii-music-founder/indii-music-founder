import asyncio
import time
import os
import aiohttp
from unittest.mock import patch, MagicMock, AsyncMock

# Setup dummy environment variables so we can reach the code
os.environ["PANDADOC_API_KEY"] = "test_key"
os.environ["GEMINI_API_KEY"] = "test_key" # Just in case

from python.tools.split_sheet_generator import SplitSheetGenerator

# Since we switched to aiohttp, we need to mock aiohttp.ClientSession
class MockClientResponse:
    def __init__(self, *args, **kwargs):
        self.status = 200

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass

    async def json(self):
        return {"id": "fake_doc_id"}

class MockClientSession:
    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass

    def post(self, *args, **kwargs):
        # We need an async context manager that sleeps before yielding the response
        class AsyncSleepPost:
            async def __aenter__(self):
                print("Executing mock async post...")
                await asyncio.sleep(1.0)
                return MockClientResponse()
            async def __aexit__(self, exc_type, exc_val, exc_tb):
                pass
        return AsyncSleepPost()

class MockResponse:
    text = "Fake Markdown Document"

class MockModels:
    def generate_content(self, *args, **kwargs):
        print("Executing generate_content...")
        time.sleep(0.5)
        return MockResponse()

class MockClient:
    def __init__(self, *args, **kwargs):
        self.models = MockModels()

async def concurrent_tasks():
    tool = SplitSheetGenerator()

    collaborators = [{"name": "A", "split_percentage": 100.0}]

    start_time = time.time()

    with patch('aiohttp.ClientSession', MockClientSession):
        with patch('google.genai.Client', return_value=MockClient()):
            with patch('python.helpers.rate_limiter.RateLimiter.wait_time', return_value=0):
                tasks = [
                    tool.execute("Test Track", collaborators, create_pandadoc=True)
                    for _ in range(3)
                ]
                results = await asyncio.gather(*tasks)

    end_time = time.time()
    print(f"Total time for 3 concurrent tasks: {end_time - start_time:.2f} seconds")
    # print results
    for i, r in enumerate(results):
        print(f"Result {i}: {r.message if hasattr(r, 'message') else 'no msg'}")

if __name__ == "__main__":
    asyncio.run(concurrent_tasks())
