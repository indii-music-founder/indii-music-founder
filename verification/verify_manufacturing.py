from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use a mobile viewport to match one of the responsive designs or a standard desktop
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()

        # 1. Login (bypass via Guest Login if available or standard flow)
        print("Navigating to login...")
        page.goto("http://localhost:4242/login")

        try:
            # Wait for any login UI to appear
            page.wait_for_timeout(2000)

            # Check for guest button
            guest_btn = page.get_by_role("button", name="Guest Login (Dev)")
            if guest_btn.is_visible():
                print("Clicking Guest Login...")
                guest_btn.click()
            else:
                print("Guest Login not found, checking if already logged in or needs manual auth...")
                # If we are already on dashboard, this might fail or timeout, which is fine
        except Exception as e:
             print(f"Login interaction error: {e}")

        # 2. Navigate to Merchandise > Showroom
        print("Navigating to Merch Designer...")
        page.wait_for_timeout(5000) # Give extra time for login redirect

        page.goto("http://localhost:4242/merch/design")
        page.wait_for_load_state("networkidle")

        # 3. Enter Showroom Mode
        print("Clicking Showroom Mode button...")
        # Use force=True in case of overlays, or check visibility
        showroom_btn = page.get_by_test_id("mode-showroom-btn")
        # Wait specifically for this button
        try:
            showroom_btn.wait_for(state="visible", timeout=10000)
            showroom_btn.click()
        except:
             print("Showroom button not visible, current URL:", page.url)
             # Fallback screenshot to debug
             page.screenshot(path="verification/debug_nav_fail.png")
             browser.close()
             return

        page.wait_for_timeout(2000)

        # 4. Verify Manufacturing Panel
        print("Verifying Manufacturing Panel...")
        # Check if "Production" header is visible
        production_header = page.get_by_text("Production")
        if production_header.is_visible():
             print("Production header found.")
        else:
             print("Production header NOT found.")

        # Check if pricing is loaded
        unit_cost = page.get_by_text("Unit Cost")
        if unit_cost.is_visible():
             print("Unit Cost label found.")
        else:
             print("Unit Cost label NOT found.")

        # Take screenshot of the Manufacturing Panel area
        page.screenshot(path="verification/manufacturing_panel_retry.png")
        print("Screenshot saved to verification/manufacturing_panel_retry.png")

        browser.close()

if __name__ == "__main__":
    run()
