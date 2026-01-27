import pytest
from unittest.mock import MagicMock, patch, mock_open
from python.tools.indii_image_gen import IndiiImageGen
from python.helpers.tool import Response

@pytest.fixture
def mock_agent():
    agent = MagicMock()
    agent.context.id = "test_project"
    return agent

@pytest.fixture
def image_tool(mock_agent):
    tool = IndiiImageGen()
    tool.agent = mock_agent
    return tool

@pytest.mark.asyncio
async def test_image_gen_success(image_tool):
    # Mock Google GenAI client
    with patch("google.genai.Client") as MockClient:
        mock_instance = MockClient.return_value
        
        # Mock generated image response
        mock_response = MagicMock()
        mock_image = MagicMock()
        mock_image.image.image_bytes = b"fake_image_bytes"
        mock_response.generated_images = [mock_image]
        
        mock_instance.models.generate_images.return_value = mock_response
        
        # Mock file system interactions
        with patch.dict("os.environ", {"GOOGLE_API_KEY": "test_key"}, clear=False):
            with patch("builtins.open", mock_open()) as mock_file:
                with patch("os.path.exists", return_value=True):
                    response = await image_tool.execute(prompt="A futuristic city", aspect_ratio="16:9")
                    
                    assert isinstance(response, Response)
                    assert response.break_loop is False
                    assert "**Gemini Image Generation Complete.**" in response.message
                    assert "img://" in response.additional["visual"]
                
                # Verify API called with correct config
                mock_instance.models.generate_images.assert_called_once()
                args, kwargs = mock_instance.models.generate_images.call_args
                assert kwargs["prompt"] == "A futuristic city, style: , aspect_ratio: 16:9"

@pytest.mark.asyncio
async def test_image_gen_no_project_id(image_tool):
    """Test fallback to default_project if context ID missing"""
    image_tool.agent.context = MagicMock()
    del image_tool.agent.context.id 
    
    with patch("google.genai.Client") as MockClient:
        mock_instance = MockClient.return_value
        mock_response = MagicMock()
        mock_image = MagicMock()
        mock_image.image.image_bytes = b"bytes"
        mock_response.generated_images = [mock_image]
        mock_instance.models.generate_images.return_value = mock_response

        with patch.dict("os.environ", {"GOOGLE_API_KEY": "test_key"}, clear=False):
            with patch("builtins.open", mock_open()):
                with patch("os.path.exists", return_value=True): 
                     # Should not raise error
                    response = await image_tool.execute(prompt="Pixel art")
                    assert "img://" in response.message
