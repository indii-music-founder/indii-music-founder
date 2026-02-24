"""
analyze_market_trends.py

Scrapes current music charts and trending sounds to provide data-driven campaign hooks.
Part of the Marketing Agent specialist toolset.
"""

import sys
import json
import asyncio
import os
from python.helpers.tool import Tool, Response
from python.helpers.browser import BrowserHelper
from python.config.ai_models import AIConfig

class AnalyzeMarketTrends(Tool):
    """
    Scrapes music trends and synthesizes them into marketing hooks.
    """

    async def execute(self, category="pop") -> Response:
        self.set_progress(f"Initializing browser research for {category} trends...")
        
        browser = BrowserHelper()
        try:
            await browser.start(headless=True)
            
            # Target URL (Billboard Hot 100 as a primary source for this proof of concept)
            url = "https://www.billboard.com/charts/hot-100/"
            self.set_progress(f"Navigating to {url}...")
            await browser.navigate(url)
            
            # Get the page content for analysis
            content = await browser.get_content()
            
            # Limit content size for LLM
            truncated_content = content[:20000] # Get first 20k chars
            
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are a Data-Driven Marketing Strategist for indiiOS.
            You are analyzing the current Billboard Hot 100 HTML content.
            
            Task:
            1. Identify the top 5 artists and their genres.
            2. Detect 3 overarching "Musical Vibe" trends (e.g., "80s Synth Revival", "Hyperpop Crossover", "Acoustic Minimal").
            3. Generate 3 unique "Campaign Hooks" for an independent artist looking to tap into these trends without copying.
            
            Format your response as a JSON object:
            {{
                "top_artists": ["Artist 1", "Artist 2", ...],
                "detected_trends": [
                    {{"trend": "Trend Name", "evidence": "Why this is trending"}}
                ],
                "campaign_hooks": [
                    {{"title": "Hook Title", "description": "Specific strategy", "why_it_works": "Logic"}}
                ]
            }}
            
            HTML Content:
            {truncated_content}
            """
            
            self.set_progress("Synthesizing market data with Gemini...")
            response = client.models.generate_content(
                model=model_id,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2
                )
            )
            
            result_data = json.loads(response.text)
            
            await browser.close()
            
            return Response(
                message=f"Market analysis complete for {category}.",
                additional={"analysis": result_data}
            )

        except Exception as e:
            if browser:
                await browser.close()
            import traceback
            return Response(message=f"Market Analysis Failed: {str(e)}\n{traceback.format_exc()}", break_loop=True)

async def main():
    # This script is intended to be called via AgentSupervisor (Electron IPC)
    # The Supervisor passes arguments as a JSON string or individual args.
    # For now, we take category from first arg.
    category = sys.argv[1] if len(sys.argv) > 1 else "pop"
    
    tool = AnalyzeMarketTrends()
    response = await tool.execute(category)
    
    # supervisor expects JSON output on stdout
    print(json.dumps({
        "success": not response.break_loop,
        "message": response.message,
        "data": response.additional.get("analysis", {}) if response.additional else {}
    }))

if __name__ == "__main__":
    asyncio.run(main())
