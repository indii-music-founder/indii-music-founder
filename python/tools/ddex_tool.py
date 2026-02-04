from python.helpers.tool import Tool, Response
from python.helpers.ddex_validator import DDEXValidator

class DDEXTool(Tool):
    """
    Agent Interface for DDEX Operations.
    """
    async def execute(self, action, xml_path, **kwargs):
        if action == "validate":
            result = DDEXValidator.validate_ern(xml_path)
            if result["valid"]:
                return Response(message=f"✅ DDEX ERN Package is VALID (Structure OK).", break_loop=False)
            else:
                error_msg = result.get("error") or ", ".join(result.get("issues", []))
                return Response(message=f"❌ DDEX Validation FAILED: {error_msg}", break_loop=False)
        
        return Response(message=f"Unknown DDEX action: {action}", break_loop=False)
