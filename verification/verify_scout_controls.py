from playwright.sync_api import Page, expect, sync_playwright
import time

def test_scout_controls(page: Page):
    # Capture console logs
    page.on("console", lambda msg: print(f"Browser Console: {msg.text}"))
    page.on("pageerror", lambda err: print(f"Browser Error: {err}"))

    print("Navigating to home...")
    # 1. Enable Test Mode
    page.goto("http://localhost:4242")
    page.evaluate("localStorage.setItem('TEST_MODE', 'true')")
    page.reload()

    # 2. Wait for dashboard
    print("Waiting for dashboard...")
    try:
        expect(page.get_by_test_id("app-container")).to_be_visible(timeout=15000)
    except:
        print("Timeout waiting for app container.")
        raise

    # 3. Navigate to Agent module
    print("Navigating to Agent module...")
    page.goto("http://localhost:4242/agent")

    # 4. Wait for Scout Controls
    print("Waiting for Agent Tools...")
    expect(page.get_by_text("Agent Tools")).to_be_visible(timeout=10000)

    # 5. Debug Auto Mode Element
    print("Debugging Auto Mode element...")
    # Try finding by text
    auto_btn = page.get_by_text("Auto Mode")
    if auto_btn.count() > 0:
        print("Found element with text 'Auto Mode'")
        # Get the button container
        # The text is inside a span, inside the button
        btn = page.locator("button", has_text="Auto Mode").first
        if btn.is_visible():
            print("Found button with text 'Auto Mode'")
            # Log attributes
            role = btn.get_attribute("role")
            aria_label = btn.get_attribute("aria-label")
            aria_checked = btn.get_attribute("aria-checked")
            print(f"Attributes -> role: {role}, aria-label: {aria_label}, aria-checked: {aria_checked}")

            if role != "switch":
                print("WARNING: HMR might not have updated the component. It should be 'switch'.")
        else:
             print("Button with text 'Auto Mode' not visible")
    else:
        print("Element with text 'Auto Mode' not found")

    # 6. Try finding by switch role again (maybe it just needed time or HMR delay)
    try:
        auto_switch = page.get_by_role("switch", name="Toggle autonomous mode")
        expect(auto_switch).to_be_visible(timeout=5000)
        print("Successfully found switch by role!")

        # 7. Focus and Interact
        print("Focusing switch...")
        auto_switch.focus()
        page.screenshot(path="verification/focus_state.png")

        print("Clicking switch...")
        auto_switch.click()
        expect(auto_switch).to_have_attribute("aria-checked", "true")

        # 8. Check inputs
        expect(page.get_by_label("Target City")).to_be_visible()
        expect(page.get_by_label("Focus Genre")).to_be_visible()

        page.screenshot(path="verification/scout_controls.png")

    except Exception as e:
        print(f"Failed to verify switch: {e}")
        page.screenshot(path="verification/debug_fail.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        try:
            test_scout_controls(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
