from playwright.sync_api import sync_playwright
import time

def verify_revenue_view():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        try:
            print("Navigating to dashboard...")
            page.goto("http://localhost:4242/")

            # Locate the Total Earnings element
            locator = page.get_by_text("Total Earnings")
            locator.wait_for(timeout=10000)

            # Scroll into view
            locator.scroll_into_view_if_needed()

            # Wait a bit for animations
            time.sleep(2)

            # Take a screenshot
            print("Taking screenshot...")
            page.screenshot(path="verification/revenue_view.png", full_page=True)
            print("Screenshot saved.")

        except Exception as e:
            print(f"Error: {e}")
            try:
                page.screenshot(path="verification/failure.png")
            except:
                pass
        finally:
            browser.close()

if __name__ == "__main__":
    verify_revenue_view()
