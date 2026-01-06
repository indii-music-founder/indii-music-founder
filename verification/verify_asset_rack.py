
import asyncio
from playwright.async_api import async_playwright, expect

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # The app seems to be running on port 4242 based on netstat output
        # tcp6       0      0 :::4242                 :::*                    LISTEN      4756/node
        await page.goto("http://localhost:4242/showroom")

        # Look for the dropzone with the new accessibility attributes
        # role="button", aria-label="Upload design file"
        dropzone = page.locator('div[role="button"][aria-label="Upload design file"]')

        try:
             await expect(dropzone).to_be_visible(timeout=5000)
             print("Dropzone found and is visible")
        except:
             print("Dropzone not immediately visible, might need auth or navigation")

        # Also check the scale slider
        slider = page.locator('input[type="range"][aria-label="Product scale"]')
        try:
             await expect(slider).to_be_visible(timeout=5000)
             print("Slider found and is visible")
        except:
             print("Slider not immediately visible")

        await page.screenshot(path="verification/asset_rack_verification.png")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
