import os
from google import genai
from google.genai import types
from python.helpers.tool import Tool, Response

class BrowserTool(Tool):
    """
    General Browser Tool.
    Refactored to use the native Gemini 2.5 Pro Google Search tool instead of Playwright,
    adhering to user preferences for the Google browser agent.
    """
    async def execute(self, action, **kwargs):
        self.set_progress(f"Native Browser Task: {action}")
        
        # Clean up legacy Playwright instances
        if hasattr(self.agent, "browser"):
            del self.agent.browser

        try:
            model_id = "gemini-2.5-pro"
            api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
            
            if not api_key:
                return Response(message="Gemini API key not found.", break_loop=True)

            client = genai.Client(api_key=api_key)
            
            url = kwargs.get("url", "")
            query = kwargs.get("query", kwargs.get("text", action))
            
            prompt = f"Action requested: {action}\nURL: {url}\nDetails: {query}\n\nPlease browse the web to find this information and return the result."

            response = client.models.generate_content(
                model=model_id,
                contents=prompt,
                config=types.GenerateContentConfig(
                    tools=[{"google_search": {}}]
                )
            )

            grounding_data = None
            if hasattr(response, "candidates") and response.candidates:
                candidate = response.candidates[0]
                if hasattr(candidate, "grounding_metadata"):
                    grounding_data = candidate.grounding_metadata

            return Response(
                message=f"**Browser Result:**\n\n{response.text}",
                break_loop=False,
                additional={"grounding": str(grounding_data) if grounding_data else None}
            )

        except Exception as e:
            return Response(message=f"Browser error: {str(e)}", break_loop=False)
