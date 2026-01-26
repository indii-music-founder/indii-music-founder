import os

"""
AI Model Configuration for indiiOS Python Tools
Centralized to prevent "hard coating" and ensure compliance with Model Policy.
"""

APPROVED_MODELS = {
    "TEXT_AGENT": "gemini-3-pro-preview",
    "TEXT_FAST": "gemini-3-flash-preview",
    "IMAGE_GEN": "gemini-3-pro-image-preview",
    "IMAGE_FAST": "gemini-2.5-flash-image",
    "AUDIO_PRO": "gemini-2.5-pro-preview-tts",
    "AUDIO_FLASH": "gemini-2.5-flash-preview-tts",
    "VIDEO_GEN": "veo-3.1-generate-preview",
    "AUDIO_ANALYSIS": "gemini-3-pro-preview", # Multimodal audio extraction
}

class AIConfig:
    # Model IDs
    TEXT_AGENT = APPROVED_MODELS["TEXT_AGENT"]
    TEXT_FAST = APPROVED_MODELS["TEXT_FAST"]
    IMAGE_GEN = APPROVED_MODELS["IMAGE_GEN"]
    VIDEO_GEN = APPROVED_MODELS["VIDEO_GEN"]
    AUDIO_ANALYSIS = APPROVED_MODELS["AUDIO_ANALYSIS"]
    
    # API Settings
    DEFAULT_API_VERSION = "v1alpha"
    DEFAULT_REGION = "us-west1"
    
    @staticmethod
    def get_api_key():
        key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        if not key:
            raise ValueError("GOOGLE_API_KEY or GEMINI_API_KEY not found in environment.")
        return key
