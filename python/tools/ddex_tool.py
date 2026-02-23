from python.helpers.tool import Tool, Response
from python.helpers.ddex_validator import DDEXValidator
from execution.distribution.ddex_generator import DDEXGenerator
import json
import os

class DDEXTool(Tool):
    """
    Agent Interface for DDEX Operations.
    """
    async def execute(self, action, **kwargs):
        if action == "validate":
            xml_path = kwargs.get("xml_path")
            if not xml_path:
                return Response(message="Error: xml_path is required for validation.", break_loop=False)
            
            result = DDEXValidator.validate_ern(xml_path)
            if result["valid"]:
                return Response(message=f"✅ DDEX ERN Package is VALID (Structure OK).", break_loop=False)
            else:
                error_msg = result.get("error") or ", ".join(result.get("issues", []))
                return Response(message=f"❌ DDEX Validation FAILED: {error_msg}", break_loop=False)
        
        elif action == "generate":
            data = kwargs.get("data")
            if not data:
                return Response(message="Error: 'data' (JSON payload) is required for generation.", break_loop=False)
            
            # If data is a string, parse it
            if isinstance(data, str):
                try:
                    data = json.loads(data)
                except Exception as e:
                    return Response(message=f"Error: Invalid JSON data: {str(e)}", break_loop=False)
            
            try:
                generator = DDEXGenerator()
                xml_output = generator.generate_ern(data)
                
                # Save to a temporary file or return the XML
                output_path = kwargs.get("output_path", "delivery_package.xml")
                with open(output_path, "w") as f:
                    f.write(xml_output)
                
                return Response(
                    message=f"✅ DDEX ERN 4.3 Package Generated: {output_path}",
                    break_loop=False,
                    additional={"xml": xml_output, "path": os.path.abspath(output_path)}
                )
            except Exception as e:
                return Response(message=f"❌ DDEX Generation FAILED: {str(e)}", break_loop=False)
        
        return Response(message=f"Unknown DDEX action: {action}", break_loop=False)
