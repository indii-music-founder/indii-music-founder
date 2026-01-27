import pytest
from unittest.mock import MagicMock, patch, mock_open
from python.tools.indii_video_gen import IndiiVideoGen
from python.helpers.tool import Response

@pytest.fixture
def mock_agent():
    agent = MagicMock()
    agent.context.id = "test_project"
    return agent

@pytest.fixture
def video_tool(mock_agent):
    tool = IndiiVideoGen()
    tool.agent = mock_agent
    return tool

@pytest.mark.asyncio
async def test_video_gen_prompt_to_video(video_tool):
    with patch("google.genai.Client") as MockClient:
        mock_instance = MockClient.return_value
        
        # Mock Response
        mock_response = MagicMock()
        mock_video = MagicMock()
        mock_video.video.video_bytes = b"fake_mp4_bytes"
        mock_response.generated_videos = [mock_video]
        
        mock_instance.models.generate_videos.return_value = mock_response
        
        with patch.dict("os.environ", {"GOOGLE_API_KEY": "test_key"}, clear=False):
            with patch("builtins.open", mock_open()) as mock_file:
                with patch("os.makedirs"): 
                     response = await video_tool.execute(prompt="A cat flying", duration=5)
                     
                     assert isinstance(response, Response)
                     assert "Gemini Video Generation Complete" in response.message
                     assert "visual" in response.additional
                     assert "img://" in response.additional["visual"]

@pytest.mark.asyncio
async def test_video_gen_image_to_video(video_tool):
    with patch("google.genai.Client") as MockClient:
        mock_instance = MockClient.return_value
        
        mock_response = MagicMock()
        mock_video = MagicMock()
        mock_video.video.video_bytes = b"fake_mp4_bytes"
        mock_response.generated_videos = [mock_video]
        mock_instance.models.generate_videos.return_value = mock_response
        
        # Mock opening source image AND saving result
        mock_file = mock_open(read_data=b"source_image_bytes")
        with patch.dict("os.environ", {"GOOGLE_API_KEY": "test_key"}, clear=False):
            with patch("builtins.open", mock_file):
                with patch("os.makedirs"):
                    response = await video_tool.execute(image_path="/tmp/source.png")
                    
                    assert isinstance(response, Response)
                    # Verify SDK call structure
                    mock_instance.models.generate_videos.assert_called()
