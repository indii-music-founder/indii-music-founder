from playwright.sync_api import sync_playwright, expect

def verify_agent_selector():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # 1. Go to app
        print("Navigating to app...")
        page.goto("http://localhost:4242")

        # 2. Login as Guest
        print("Logging in as guest...")
        # Check if we are on login page
        try:
            guest_btn = page.get_by_role("button", name="Guest Login (Dev)")
            guest_btn.click()
        except:
            print("Guest button not found, maybe already logged in or wrong page.")
            page.screenshot(path="verification_debug_login.png")

        # 3. Wait for app to load
        print("Waiting for app content...")
        # Wait for Sidebar or something
        try:
            expect(page.get_by_test_id("app-container")).to_be_visible(timeout=10000)
        except:
             print("App container not found.")
             page.screenshot(path="verification_debug_app.png")

        # 4. Open Agent Window via Store
        print("Opening agent window...")
        page.evaluate("window.useStore.setState({ isAgentOpen: true })")

        # 5. Wait for Agent Selector
        # I forced showInvite=true in ChatOverlay, so it should appear inside the overlay.
        # "Council Directory" is the header text in AgentSelector.
        print("Waiting for Agent Selector...")
        try:
            expect(page.get_by_text("Council Directory")).to_be_visible(timeout=5000)

            # 6. Take Screenshot
            print("Taking screenshot...")
            page.screenshot(path="verification_agent_selector.png")
            print("Screenshot saved to verification_agent_selector.png")
        except Exception as e:
            print(f"Agent Selector not visible: {e}")
            page.screenshot(path="verification_debug_fail.png")

        browser.close()

if __name__ == "__main__":
    verify_agent_selector()
