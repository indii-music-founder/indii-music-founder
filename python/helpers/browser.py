import asyncio
from playwright.async_api import async_playwright

class BrowserHelper:
    def __init__(self):
        self.playwright = None
        self.browser = None
        self.context = None
        self.page = None

    async def start(self, headless=True):
        if not self.playwright:
            self.playwright = await async_playwright().start()
        if not self.browser:
            self.browser = await self.playwright.chromium.launch(headless=headless)
            self.context = await self.browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1280, "height": 720}
            )
            self.page = await self.context.new_page()

    async def navigate(self, url):
        if not self.page:
            await self.start()
        await self.page.goto(url, wait_until="domcontentloaded")
        return await self.page.title()

    async def get_content(self):
        if not self.page:
            return ""
        return await self.page.content()

    async def screenshot(self, path):
        if not self.page:
            return None
        await self.page.screenshot(path=path)
        return path

    async def close(self):
        if self.page:
            await self.page.close()
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
        self.page = None
        self.browser = None
        self.playwright = None
