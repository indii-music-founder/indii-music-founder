import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class MerchandiseHeatmapAnalyzer(Tool):
    """
    Brand Manager Tool.
    Analyzes past merch sales data to recommend future design concepts.
    """

    async def execute(self, historic_sales_json: str, target_season: str) -> Response:
        self.set_progress(f"Analyzing merch heatmaps for {target_season} recommendations")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Merchandise & Brand Manager.
            Analyze the following historic merchandise sales data to recommend 3 new design concepts for the {target_season} season.
            
            Sales Data:
            {historic_sales_json}
            
            Rules:
            1. Identify the top selling garment type (e.g., Heavyweight Hoodie vs. Dad Hat).
            2. Identify the aesthetic that sold best (e.g., Minimalist vs. Y2K maximalist).
            3. Recommend 3 specific new products to manufacturer based on these trends and seasonality.
            
            Return ONLY a JSON object:
            {{
              "data_insights": "The vintage wash black tees vastly outperformed the bright colorways.",
              "recommendations": [
                {{"product": "Heavyweight Zip-Up Hoodie", "design_direction": "Minimalist embroidered logo on left breast", "estimated_roi": "High"}}
              ]
            }}
            """
            
            response = client.models.generate_content(
                model=model_id,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.3
                )
            )
            
            return Response(
                message=f"Merchandise heatmap analyzed. {target_season} concepts generated.",
                additional={"merch_strategy": json.loads(response.text)}
            )

        except Exception as e:
            import traceback
            return Response(message=f"Merchandise Heatmap Analyzer Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
