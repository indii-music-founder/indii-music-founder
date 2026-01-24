from playwright.sync_api import sync_playwright, expect

def verify_aria():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            print("Navigating to http://localhost:4242...")
            page.goto("http://localhost:4242")

            # Check for login
            try:
                # Look for text "Guest Login (Dev)" or button
                guest_btn = page.get_by_role("button", name="Guest Login (Dev)")
                if guest_btn.is_visible(timeout=5000):
                    print("Clicking Guest Login...")
                    guest_btn.click()
                    page.wait_for_load_state("networkidle")
            except Exception as e:
                print(f"Login step info: {e}")

            print("Waiting for Delegate button...")
            delegate_btn = page.locator('button[aria-label="Select active agent"]')
            delegate_btn.wait_for(state="visible", timeout=10000)

            print("Delegate button found!")
            print(f"aria-haspopup: {delegate_btn.get_attribute('aria-haspopup')}")
            print(f"aria-expanded: {delegate_btn.get_attribute('aria-expanded')}")

            assert delegate_btn.get_attribute("aria-haspopup") == "true"

            # Check Indii Toggle button
            indii_btn_1 = page.locator('button[aria-label="Switch to indii mode"]')
            indii_btn_2 = page.locator('button[aria-label="Switch to Agent mode"]')

            if indii_btn_1.is_visible():
                print("Found button: Switch to indii mode")
            elif indii_btn_2.is_visible():
                print("Found button: Switch to Agent mode")
            else:
                # Fallback search to debug
                print("Could not find Indii toggle by new aria label. Dumping buttons...")
                # This might be too noisy, skipping
                raise Exception("Indii toggle not found with expected aria-labels")

            print("Verification Successful!")
            page.screenshot(path="verification/aria_verification.png")

        except Exception as e:
            print(f"Verification Failed: {e}")
            page.screenshot(path="verification/failure.png")
            raise e
        finally:
            browser.close()

if __name__ == "__main__":
    verify_aria()
