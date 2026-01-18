from playwright.sync_api import sync_playwright, expect
import os
import time

def run():
    print("Starting verification script...")
    with sync_playwright() as p:
        iphone_12 = p.devices['iPhone 12 Pro']
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(**iphone_12)
        page = context.new_page()

        print("Navigating to http://localhost:4242...")
        try:
            page.goto("http://localhost:4242", timeout=30000)
        except:
            page.goto("http://localhost:5173", timeout=30000)

        # Login
        try:
            guest_btn = page.get_by_role("button", name="Guest Login (Dev)")
            if guest_btn.is_visible(timeout=5000):
                guest_btn.click()
                page.wait_for_timeout(2000)
        except:
            pass

        # Open Menu
        print("Waiting for FAB...")
        try:
            fab = page.get_by_label("Open Navigation")
            expect(fab).to_be_visible(timeout=10000)
            fab.click()

            print("Waiting for Menu Content...")
            # We filter by visibility to ignore the hidden desktop sidebar instance
            expect(page.get_by_text("Manager's Office").locator("visible=true")).to_be_visible()

            print("Taking screenshot...")
            if not os.path.exists("verification"):
                os.makedirs("verification")
            page.screenshot(path="verification/mobile_nav_menu.png")
            print("Screenshot saved to verification/mobile_nav_menu.png")

        except Exception as e:
            print(f"Verification failed: {e}")
            page.screenshot(path="verification/error_state_retry.png")

        browser.close()

if __name__ == "__main__":
    run()
