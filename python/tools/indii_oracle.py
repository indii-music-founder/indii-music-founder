
from python.helpers.rate_limiter import RateLimiter
import asyncio
import os
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class IndiiOracle(Tool):
    """
    The Oracle component for indiiOS.
    Computes Aesthetic Scoring and Relative Information Gain (RIG) for media assets.
    Enables self-evolution loop for Architect-Sentinel-Oracle orchestration.
    """

    async def execute(self, asset_path: str, context: str = "") -> Response:
        self.set_progress("Initiating Oracle evaluation...")

        try:
            # 1. Environment Check
            if not os.path.exists(asset_path):
                return Response(message=f"Oracle Error: Asset not found at {asset_path}", break_loop=False)

            # 2. API Call Setup (Using Pro for Reasoning)
            from google import genai
            from google.genai import types

            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_AGENT

            # 3. Multi-Modal Analysis
            # Load asset for visual quality assessment
            with open(asset_path, "rb") as f:
                asset_data = f.read()

            mime_type = "image/png" if asset_path.endswith(".png") else "video/mp4"

            prompt = f"""
            Identify as the indiiOS Media Oracle.
            Evaluate the following asset based on the provided context.

            Context: {context}

            Tasks:
            1. Aesthetic Scoring (1-100): Depth, composition, lighting, cinematic fidelity.
            2. Relative Information Gain (RIG): Does this render provide new creative insights vs. generic outputs?
            3. Alignment Check: Does it stick to the style guide?
            4. Self-Evolution Directive: Propose one specific prompt refinement to improve the next iteration.

            Return JSON format.
            """

            _rl = RateLimiter()
            wait_time = _rl.wait_time("gemini")
            if wait_time > 0:
                self.set_progress(f"Rate limiting: waiting {wait_time:.1f}s")
                await asyncio.sleep(wait_time)

            response = client.models.generate_content(
                model=model_id,
                contents=[
                    types.Part.from_bytes(data=asset_data, mime_type=mime_type),
                    prompt
                ]
            )

            # 4. Result Handoff
            return Response(
                message=f"**Oracle Evaluation Report:**\n\n{response.text}",
                additional={
                    "oracle_score": response.text, # Assuming JSON in text
                    "refined_prompt_candidate": True
                }
            )

        except Exception as e:
            import traceback
            return Response(message=f"Oracle Evaluation Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
