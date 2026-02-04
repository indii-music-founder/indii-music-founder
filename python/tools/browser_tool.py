from python.helpers.tool import Tool, Response
try:
    from python.helpers.browser import Browser
except ImportError:
    # Fallback for when running from root context vs package context
    import sys
    import os
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
    from python.helpers.browser import Browser
import os

class BrowserTool(Tool):
    async def execute(self, action, **kwargs):
        if not hasattr(self.agent, "browser"):
            self.agent.browser = Browser(headless=True)
            await self.agent.browser.start()

        browser = self.agent.browser

        try:
            if action == "open":
                url = kwargs.get("url")
                await browser.open(url)
                return Response(message=f"Opened {url}", break_loop=False)
            
            elif action == "click":
                selector = kwargs.get("selector")
                await browser.click(selector)
                return Response(message=f"Clicked {selector}", break_loop=False)

            elif action == "type":
                selector = kwargs.get("selector")
                text = kwargs.get("text")
                await browser.fill(selector, text)
                return Response(message=f"Typed '{text}' into {selector}", break_loop=False)
            
            elif action == "get_dom":
                dom = await browser.get_clean_dom()
                return Response(message=dom, break_loop=False)
            
            elif action == "screenshot":
                 path = kwargs.get("path", "screenshot.png")
                 await browser.screenshot(path)
                 return Response(message=f"Screenshot saved to {path}", break_loop=False)
            
            elif action == "close":
                await browser.close()
                del self.agent.browser
                return Response(message="Browser closed", break_loop=False)

            else:
                return Response(message=f"Unknown browser action: {action}", break_loop=False)

        except Exception as e:
            return Response(message=f"Browser error: {str(e)}", break_loop=False)
