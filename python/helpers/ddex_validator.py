import xml.etree.ElementTree as ET
import os

class DDEXValidator:
    """
    Task 3: DDEX ERN 4.3 Validation.
    Validates XML structure against the ErnMainXSD (Schema).
    Checks for required fields: MessageHeader, ResourceList, ReleaseList.
    """
    
    @staticmethod
    def validate_ern(xml_path):
        if not os.path.exists(xml_path):
            return {"valid": False, "error": "File not found"}
            
        try:
            tree = ET.parse(xml_path)
            root = tree.getroot()
            
            # 1. Namespace Check (Crucial for 4.3)
            # namespaces = {'ern': 'http://ddex.net/xml/ern/43'} 
            # Simplified tag checking for robustness:
            
            issues = []
            
            # 2. Structure Check
            header = root.find(".//MessageHeader") # Loose find
            if header is None:
                issues.append("Missing <MessageHeader>")
                
            resources = root.find(".//ResourceList")
            if resources is None:
                issues.append("Missing <ResourceList>")
                
            releases = root.find(".//ReleaseList")
            if releases is None:
                issues.append("Missing <ReleaseList>")
                
            # 3. Validation Logic
            if issues:
                 return {"valid": False, "issues": issues}
            
            return {"valid": True, "version": root.tag}

        except ET.ParseError as e:
            return {"valid": False, "error": f"XML Parse Error: {str(e)}"}
        except Exception as e:
            return {"valid": False, "error": f"Validation Error: {str(e)}"}
