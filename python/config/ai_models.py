import os

"""
AI Model Configuration for indiiOS Python Tools
Centralized to prevent "hard coating" and ensure compliance with Model Policy.
"""

APPROVED_MODELS = {
    "TEXT_AGENT": "gemini-3.5-flash",
    "TEXT_FAST": "gemini-3.5-flash",
    "IMAGE_GEN": "gemini-3.5-flash-image-preview",
    "IMAGE_FAST": "gemini-3.5-flash-image-preview",
    "AUDIO_PRO": "gemini-3.5-flash",
    "AUDIO_FLASH": "gemini-3.5-flash",
    "VIDEO_GEN": "veo-3.1-generate-preview",
    "AUDIO_ANALYSIS": "gemini-3.5-flash", # Multimodal audio extraction
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
    DEFAULT_REGION = "us-central1"
    
    @staticmethod
    def get_api_key():
        key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        if not key:
            raise ValueError("GOOGLE_API_KEY or GEMINI_API_KEY not found in environment.")
        return key
