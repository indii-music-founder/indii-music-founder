import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class ContractAnalyzer(Tool):
    """
    Analyzes legal contracts (PDFs) to extract key terms and flag unfavorable clauses.
    """

    async def execute(self, action: str, file_path: str = "") -> Response:
        self.set_progress(f"Initiating Contract Analysis: {action}")
        
        try:
            from google import genai
            from google.genai import types
            import os
            
            if not file_path or not os.path.exists(file_path):
                 return Response(message=f"Error: Contract file not found at {file_path}", break_loop=False)
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_AGENT # Pro required for complex legal reasoning
            
            with open(file_path, "rb") as f:
                asset_data = f.read()
            mime_type = "application/pdf"
            
            if action == "extract_terms":
                prompt = """
                You are indiiOS Legal Counsel. Analyze this contract and extract the key terms into JSON.
                
                Required JSON format:
                {
                  "type": "Record Deal, Publishing, Split Sheet, etc.",
                  "parties": ["Name 1", "Name 2"],
                  "term": "Length of agreement (e.g. 5 years, in perpetuity)",
                  "territory": "Worldwide, US only, etc.",
                  "royalties_or_splits": "Extracted numerical splits or royalty rates",
                  "flags": ["Clause 4a is unfavorable because it limits audit rights", "Term length is unusually long"]
                }
                
                Extract these fields accurately based ONLY on the provided PDF text. If a field is not present, mark it "Not specified".
                """
                response = client.models.generate_content(
                    model=model_id,
                    contents=[
                        types.Part.from_bytes(data=asset_data, mime_type=mime_type),
                        prompt
                    ],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.0 # High factuality
                    )
                )
                return Response(
                    message="Contract Terms Extracted",
                    additional={"analysis": json.loads(response.text)}
                )

            else:
                return Response(message=f"Unknown action: {action}", break_loop=False)

        except Exception as e:
            import traceback
            return Response(message=f"Contract Analyzer Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)

