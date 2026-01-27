from python.helpers.api import ApiHandler, Response
from python.helpers import files
import os
import shutil
import json

class ProvisionProject(ApiHandler):
    """
    API Handler to provision new Projects (Departments/Artists).
    Ensures consistent directory structure and secret injection.
    """
    methods = ["POST"]

    @staticmethod
    def get_methods():
        return ["POST"]

    @staticmethod
    def requires_csrf():
        return False

    @staticmethod
    def requires_api_key():
        return False

    async def process(self, input_data: dict, request):
        """
        Payload:
        {
            "project_id": "dept_legal",
            "role_type": "legal_expert",  # maps to prompts/templates/{type}.md
            "initial_secrets": { "DB_KEY": "..." } # Optional
        }
        """
        project_id = input_data.get("project_id")
        role_type = input_data.get("role_type", "generic")
        initial_secrets = input_data.get("initial_secrets", {})

        if not project_id:
            return {"status": "error", "message": "Missing project_id"}

        # Paths
        # /a0/usr/projects is the standard root in Docker
        project_root = f"/a0/usr/projects/{project_id}"
        
        try:
            # 1. Create Directory Structure
            os.makedirs(os.path.join(project_root, "assets"), exist_ok=True)
            os.makedirs(os.path.join(project_root, "knowledge"), exist_ok=True)
            os.makedirs(os.path.join(project_root, "memory"), exist_ok=True)
            os.makedirs(os.path.join(project_root, ".a0proj"), exist_ok=True) # For secrets

            # 2. Inject Role Instructions
            # We assume templates are mapped to /a0/prompts/templates
            template_path = f"/a0/prompts/templates/{role_type}.md"
            target_instruction = os.path.join(project_root, "instructions.md")

            if os.path.exists(template_path):
                shutil.copy(template_path, target_instruction)
            else:
                # Fallback if specific template missing
                with open(target_instruction, "w") as f:
                    f.write(f"You are an agent specializing in {role_type}. Please assist the user.")

            # 3. Inject Secrets (if provided)
            if initial_secrets:
                secrets_path = os.path.join(project_root, ".a0proj", "secrets.env")
                with open(secrets_path, "w") as f:
                    for key, value in initial_secrets.items():
                        # Simple format: KEY=VALUE
                        f.write(f"{key}={value}\n")

            # 4. Inject Settings (Tiered Memory)
            # Enable "include_global_knowledge" to allow this project to see /a0/knowledge
            settings_path = os.path.join(project_root, "settings.json")
            settings_data = {
                "include_global_knowledge": True,
                "project_name": project_id,
                "description": f"Role: {role_type}"
            }
            with open(settings_path, "w") as f:
                json.dump(settings_data, f, indent=2)

            return {
                "status": "success", 
                "message": f"Project {project_id} provisioned as {role_type} with Global Knowledge enabled",
                "path": project_root
            }

        except Exception as e:
            return {"status": "error", "message": str(e)}
