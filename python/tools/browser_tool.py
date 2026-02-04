from python.helpers.tool import Tool, Response
from python.helpers.browser import BrowserHelper
import os
import time

# Global instance to persist session across tool calls
_BROWSER_HELPER = None

class BrowserTool(Tool):
    """
    Allows the agent to browse the web using a real Chrome instance.
    Actions: open, navigate, read, screenshot, close.
    """
    async def execute(self, action="open", url=None, **kwargs):
        global _BROWSER_HELPER
        
        self.set_progress(f"Browser Tool: {action} {url if url else ''}")

        if _BROWSER_HELPER is None:
            _BROWSER_HELPER = BrowserHelper()
        
        try:
            if action == "open" or action == "navigate":
                if not url:
                    return Response("Error: URL required for navigation.")
                # Local dev mode: headless=False for visibility
                await _BROWSER_HELPER.start(headless=False)
                title = await _BROWSER_HELPER.navigate(url)
                return Response(f"Navigated to {url}. Page Title: {title}")

            elif action == "read":
                content = await _BROWSER_HELPER.get_content()
                # Truncate for token sanity
                preview = content[:2000] + "... [Truncated]"
                return Response(f"Page Content:\n{preview}")

            elif action == "screenshot":
                # Ensure assets dir exists
                assets_dir = os.path.expanduser("~/Documents/indiiOS/screenshots")
                os.makedirs(assets_dir, exist_ok=True)
                filename = f"screen_{int(time.time())}.png"
                path = os.path.join(assets_dir, filename)
                
                await _BROWSER_HELPER.screenshot(path)
                return Response(f"Screenshot saved to {path}", additional={"image": f"file://{path}"})

            elif action == "close":
                await _BROWSER_HELPER.close()
                _BROWSER_HELPER = None
                return Response("Browser session closed.")

            else:
                return Response(f"Unknown action: {action}")

        except Exception as e:
            return Response(f"Browser Error: {str(e)}")
