import asyncio
import time
import os
import requests
from unittest.mock import patch, MagicMock

# Setup dummy environment variables so we can reach the code
os.environ["PANDADOC_API_KEY"] = "test_key"
os.environ["GEMINI_API_KEY"] = "test_key" # Just in case

from python.tools.split_sheet_generator import SplitSheetGenerator
from python.config.ai_models import AIConfig

def mock_post(*args, **kwargs):
    print("Executing mock_post...")
    time.sleep(1.0)
    mock_res = MagicMock()
    mock_res.ok = True
    mock_res.json.return_value = {"id": "fake_doc_id"}
    return mock_res

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

    with patch('requests.post', side_effect=mock_post):
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
