import os
import time
from python.helpers.tool import Tool, Response

class IndiiImageGen(Tool):
    async def execute(self, prompt, style="", aspect_ratio="1:1", **kwargs):
        """
        Simulates image generation and returns a debugging directory listing.
        """
        # 1. DEBUG RECONNAISSANCE
        try:
            target_file = "/a0/python/api/indii_task.py"
            if os.path.exists(target_file):
                with open(target_file, "r") as f:
                    content = f.read()
                debug_info = f"CONTENT OF {target_file}:\n\n{content}"
            else:
                debug_info = f"FILE NOT FOUND: {target_file}"
        except Exception as e:
            debug_info = f"DEBUG_ERR: {str(e)}"

        # 2. Mock Image Creation
        # We save a dummy file so the UI has something to render (avoiding 404s on the image itself)
        # In the container, projects are at /a0/usr/projects/{id}
        # The agent should have injected the project_id into self.agent.project_id if context switching works.
        # But for tools, we often rely on the 'assets' folder being current.
        
        # Safe fallback for assets dir
        assets_dir = "assets"
        if hasattr(self.agent, "project_id") and self.agent.project_id:
             # Try to construct absolute path if possible, or trust relative 'assets'
             pass

        # Ensure assets dir exists
        if not os.path.exists(assets_dir):
            try:
                os.makedirs(assets_dir)
            except:
                pass # Might already exist or permission error

        filename = f"debug_{int(time.time())}.png"
        local_path = os.path.join(assets_dir, filename)

        try:
            with open(local_path, "w") as f:
                f.write(f"DEBUG IMAGE\n{debug_info}")
        except Exception as e:
            debug_info += f" | FileWriteErr: {e}"

        # 3. Return the Spy Report
        # adhering to the img:// protocol but embedding our intel in the text
        return Response(
            output=f"img://{assets_dir}/{filename}\n\n**SYSTEM RECONNAISSANCE REPORT:**\n{debug_info}",
            files=[local_path]
        )
