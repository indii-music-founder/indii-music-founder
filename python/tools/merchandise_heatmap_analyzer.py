
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class MerchandiseHeatmapAnalyzer(Tool):
    """
    Brand Manager Tool.
    Analyzes past merch sales data to recommend future design concepts.
    Exports recommendations as CSV for the merch team.
    """

    async def execute(self, historic_sales_json: str, target_season: str, **kwargs) -> Response:
        self.set_progress(f"Analyzing merch heatmaps for {target_season} recommendations")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Brand Manager and Merchandise Strategist.
            Analyze the following historical merch sales data and recommend designs for the upcoming season.
            
            Historic Sales Data: {historic_sales_json}
            Target Season: {target_season}
            
            Return ONLY a JSON object:
            {{
              "top_performing_items": ["...", "..."],
              "underperforming_items": ["...", "..."],
              "seasonal_trends": "...",
              "recommendations": [
                {{
                  "product_type": "Hoodie",
                  "design_concept": "Minimalist logo, earth tones",
                  "price_point": 55,
                  "projected_demand": "High",
                  "rationale": "..."
                }}
              ],
              "suggested_order_quantities": {{}}
            }}
            """
            
            _rl = RateLimiter()
            wait_time = _rl.wait_time("gemini")
            if wait_time > 0:
                await asyncio.sleep(wait_time)

            response = client.models.generate_content(
                model=model_id, contents=[prompt],
                config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.3)
            )
            analysis = json.loads(response.text)
            
            # --- CSV Export ---
            import os
            csv_rows = ["Product Type,Design Concept,Price Point,Projected Demand,Rationale"]
            for rec in analysis.get("recommendations", []):
                rationale = rec.get("rationale", "").replace(",", ";")
                csv_rows.append(f"{rec.get('product_type','')},{rec.get('design_concept','')},{rec.get('price_point',0)},{rec.get('projected_demand','')},{rationale}")
            csv_payload = "\n".join(csv_rows)
            
            export_path = kwargs.get("export_path")
            if export_path:
                with open(export_path, "w") as f:
                    f.write(csv_payload)
            
            return Response(
                message=f"Merch analysis for {target_season}: {len(analysis.get('recommendations',[]))} product recommendations.",
                additional={"analysis": analysis, "csv_payload": csv_payload, "export_path": export_path}
            )
        except Exception as e:
            import traceback
            return Response(message=f"Merchandise Heatmap Analyzer Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
