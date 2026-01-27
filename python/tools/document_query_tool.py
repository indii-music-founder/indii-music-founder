import os
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class DocumentQueryTool(Tool):
    """
    RAG-based tool to query project documents, style guides, and brand bibles.
    Enables media generation to remain 'on-brand'.
    """

    async def execute(self, query: str, document_path: str = None) -> Response:
        self.set_progress(f"Querying document: {document_path or 'Project Context'}...")
        
        try:
            # 1. API Call Setup
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_AGENT # Use Pro for reasoning

            # 2. Document Context Resolution
            # If document_path is provided, we read it. If not, we look for 'style_guide.md' in current project.
            if not document_path:
                try:
                    project_id = getattr(self.agent.context, 'id', 'default_project')
                    # Standard location for project-specific brand assets
                    document_path = os.path.join("/a0/usr/projects", project_id, "style_guide.md")
                except:
                    pass

            doc_content = ""
            if document_path and os.path.exists(document_path):
                with open(document_path, "r") as f:
                    doc_content = f.read()
            else:
                return Response(message="Warning: No style guide or document found for alignment. Using general reasoning.", break_loop=False)

            # 3. Perform RAG Query
            prompt = f"""
            You are a Brand Sentinel. Analyze the following style guide/document and answer the query to guide media generation.
            
            Style Guide Content:
            ---
            {doc_content}
            ---
            
            Query: {query}
            
            Provide a high-signal answer that can be used as instructions for an image or video generation tool.
            """

            response = client.models.generate_content(
                model=model_id,
                contents=prompt
            )

            return Response(
                output=f"**Brand Alignment Analysis:**\n\n{response.text}",
                additional={
                    "document_queried": document_path,
                    "model": model_id
                }
            )

        except Exception as e:
            import traceback
            return Response(message=f"Document Query Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
