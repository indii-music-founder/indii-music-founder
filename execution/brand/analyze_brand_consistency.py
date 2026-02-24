#!/usr/bin/env python3
import json
import asyncio
import os
import sys
from typing import Dict, Any, List

# Ensure parent project root is in path for imports from python.*
# When running from execution/brand/ the root is 2 levels up
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig
from python.helpers.rate_limiter import RateLimiter

class AnalyzeBrandConsistency(Tool):
    """
    Multimodal analysis of visual assets against Brand Kit guidelines.
    Evaluation criteria: Color Palette, Typography, and Aesthetic/Vibe.
    """

    async def execute(self, asset_path: str, brand_kit_json: str) -> Response:
        """
        Executes the brand consistency analysis.
        
        Args:
            asset_path: Path to the visual asset (image/video frame)
            brand_kit_json: JSON string containing brand guidelines (colors, fonts, vibe)
        """
        self.set_progress(f"Initializing brand consistency audit for: {os.path.basename(asset_path)}")
        
        try:
            # Parse brand kit
            try:
                brand_kit = json.loads(brand_kit_json)
            except json.JSONDecodeError:
                return Response(
                    message="Error: Invalid brand_kit_json format. Expected a JSON string.", 
                    additional={"status": "error", "error": "JSON_PARSE_ERROR"}
                )

            # Load Google GenAI SDK
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            
            # Use Gemini 3 Pro for Vision (Multimodal Reasoning)
            model_id = AIConfig.TEXT_AGENT 
            
            # Read asset data
            if not os.path.exists(asset_path):
                return Response(
                    message=f"Error: Asset file not found at {asset_path}", 
                    additional={"status": "error", "error": "FILE_NOT_FOUND"}
                )

            with open(asset_path, "rb") as f:
                asset_data = f.read()
                
            mime_type = "image/png" if asset_path.lower().endswith(".png") else "image/jpeg"
            if asset_path.lower().endswith(".webp"):
                mime_type = "image/webp"

            # Rich prompt construction based on the provided Brand Kit
            brand_summary = json.dumps(brand_kit, indent=2)
            
            prompt = f"""
            You are the indiiOS Brand Manager. Your task is to analyze the consistency of the provided visual asset against the artist's official Brand Kit.
            
            ### Artist Brand Kit Guidelines:
            {brand_summary}
            
            ### Analysis Requirements:
            1. **Color Palette Matching**: Compare the dominant colors in the image with the primary/secondary hex codes in the Brand Kit.
            2. **Typography Audit**: If any text is present, check if the font style matches the defined typography guidelines.
            3. **Aesthetic/Vibe alignment**: Evaluate if the composition, lighting, and "mood" of the asset match the brand's mission (e.g., "Neon Noir", "Minimalist Folk").
            
            ### Response Protocol:
            Return a strictly formatted JSON object with the following fields:
            {{
                "consistency_score": (integer 0-100),
                "consistent": (boolean),
                "summary": "2-3 sentence overview of the audit",
                "findings": [
                    {{
                        "category": "Colors",
                        "status": "PASS" | "WARN" | "FAIL",
                        "feedback": "Detailed observation"
                    }},
                    {{
                        "category": "Typography",
                        "status": "PASS" | "WARN" | "FAIL" | "N/A",
                        "feedback": "Detailed observation"
                    }},
                    {{
                        "category": "Vibe",
                        "status": "PASS" | "WARN" | "FAIL",
                        "feedback": "Detailed observation"
                    }}
                ],
                "recommendations": ["Actionable improvement 1", "Actionable improvement 2"]
            }}
            """
            
            # Apply Rate Limiting
            _rl = RateLimiter()
            wait_time = _rl.wait_time("gemini")
            if wait_time > 0:
                self.set_progress(f"Rate limiting active: waiting {wait_time:.1f}s")
                await asyncio.sleep(wait_time)

            self.set_progress("Processing multimodal analysis via Gemini 3 Pro...")
            
            response = client.models.generate_content(
                model=model_id,
                contents=[
                    types.Part.from_bytes(data=asset_data, mime_type=mime_type),
                    prompt
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.0  # High precision
                )
            )
            
            # Parse response
            try:
                result = json.loads(response.text)
                status_msg = "CONSISTENT" if result.get("consistent") else "INCONSISTENT"
                score = result.get("consistency_score", 0)
                
                # Standardized response for AgentSupervisor
                return Response(
                    message=f"Brand Audit Complete: {status_msg} (Score: {score})",
                    additional={
                        "status": "success",
                        "data": result
                    }
                )
            except json.JSONDecodeError:
                return Response(
                    message="Error: LLM returned invalid JSON.",
                    additional={
                        "status": "error",
                        "error": "LLM_INVALID_JSON",
                        "raw_response": response.text
                    }
                )
            
        except Exception as e:
            import traceback
            return Response(
                message=f"Brand Consistency Analysis Failed: {str(e)}",
                additional={
                    "status": "error",
                    "error": str(e),
                    "traceback": traceback.format_exc()
                }
            )

if __name__ == "__main__":
    # Standard IPC execution pattern
    import argparse
    
    parser = argparse.ArgumentParser(description="Brand Consistency Analysis Tool")
    parser.add_argument("asset_path", help="Path to the visual asset")
    parser.add_argument("brand_kit", help="JSON string of the brand kit")
    parser.add_argument("--storage-path", help="Optional persistence path")
    
    args = parser.parse_args()
    
    tool = AnalyzeBrandConsistency()
    result_response = asyncio.run(tool.execute(args.asset_path, args.brand_kit))
    
    # Final output as captured by PythonBridge
    # We output the 'additional' field which contains the formatted {status, data} 
    # OR we follow the Response object structure if compatible.
    # PythonBridge expects JSON on the last line.
    print(json.dumps(result_response.additional))
