import os
from google import genai
from google.genai import types
from python.helpers.tool import Tool, Response

class GeminiBrowserTool(Tool):
    """
    Task: Native Gemini 2.5 Browser Agent.
    Uses the Gemini 2.5 Pro native Google Browser/Search agent to surf the web and achieve the goal.
    This replaces Playwright with Google's native agentic capabilities.
    """

    async def execute(self, goal, url=None, **kwargs):
        self.set_progress(f"Initiating Native Gemini 2.5 Browser Agent for: {goal}")
        
        # Cleanup any legacy Playwright instances to adhere to user constraints
        if hasattr(self.agent, "browser"):
            del self.agent.browser
            
        try:
            # We strictly use gemini-2.5-pro for the browser agent as per user constraints
            model_id = "gemini-2.5-pro"
            api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
            
            if not api_key:
                return Response(message="Gemini API key not found in environment.", break_loop=True)

            client = genai.Client(api_key=api_key)
            
            # Combine URL and goal if URL is provided
            prompt = f"Target URL: {url}\nGoal: {goal}" if url else goal
            
            response = client.models.generate_content(
                model=model_id,
                contents=prompt,
                config=types.GenerateContentConfig(
                    tools=[{"google_search": {}}]
                )
            )

            # Extract grounding metadata if available
            grounding_data = None
            if hasattr(response, "candidates") and response.candidates:
                candidate = response.candidates[0]
                if hasattr(candidate, "grounding_metadata"):
                    grounding_data = candidate.grounding_metadata

            return Response(
                message=f"**Gemini 2.5 Browser Result:**\n\n{response.text}",
                break_loop=False,
                additional={"grounding": str(grounding_data) if grounding_data else None}
            )

        except Exception as e:
            return Response(message=f"Gemini Browser Agent Error: {str(e)}", break_loop=True)
