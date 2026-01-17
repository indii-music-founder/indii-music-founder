from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1500, "height": 900})

        # 1. Login
        print("Navigating to login...")
        page.goto("http://localhost:4242")

        # Wait for login button
        print("Waiting for login button...")
        try:
            page.get_by_role("button", name="Guest Login (Dev)").click(timeout=10000)
        except Exception as e:
            print("Login button not found or timeout. Dumping page content.")
            print(page.content())
            page.screenshot(path="verification/login_fail.png")
            raise e

        # 2. Navigate to Merch
        print("Navigating to Merch...")
        try:
            # Wait for sidebar or dashboard
            page.get_by_test_id("nav-item-merch").wait_for(timeout=15000)
            page.get_by_test_id("nav-item-merch").click()
        except Exception as e:
            print("Merch nav item not found. Dumping page content.")
            page.screenshot(path="verification/nav_fail.png")
            raise e

        # 3. Enter Designer
        print("Entering Designer...")
        try:
            page.get_by_test_id("merch-dashboard-content").wait_for()
            page.get_by_test_id("new-design-btn").click()
        except Exception as e:
             print("Merch dashboard not loaded. Dumping page content.")
             page.screenshot(path="verification/dashboard_fail.png")
             raise e

        # 4. Verify Showroom and Manufacturing Panel
        print("Verifying Showroom...")
        try:
            # Switch to Showroom mode
            print("Switching to Showroom mode...")
            page.get_by_test_id("mode-showroom-btn").click()

            # Handle Export Dialog if it appears
            try:
                 export_btn = page.get_by_role("button", name="Export", exact=True)
                 if export_btn.is_visible(timeout=2000):
                     print("Export dialog appeared. Clicking Export...")
                     export_btn.click()
            except Exception:
                 print("Export dialog did not appear or was skipped.")

            # Check for Showroom header
            expect(page.get_by_text("Product Showroom")).to_be_visible(timeout=15000)

            # Check for Manufacturing Panel elements (Production column)
            # "Item Spec" is a label in the ManufacturingPanel
            expect(page.get_by_text("Item Spec")).to_be_visible()
            expect(page.get_by_text("Base Color")).to_be_visible()

            # Check for Default Cost (should be visible if calculated correctly)
            # It might take a moment to appear if there is async logic, but we mocked it/or using defaults
            # "Unit Cost" text
            expect(page.get_by_text("Unit Cost")).to_be_visible()

            print("Verification successful!")
            page.screenshot(path="verification/merch_verified.png")

        except Exception as e:
            print("Verification failed. Taking screenshot.")
            page.screenshot(path="verification/merch_fail.png")
            raise e

        browser.close()

if __name__ == "__main__":
    run()
