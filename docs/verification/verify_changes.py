
from playwright.sync_api import sync_playwright

def verify_toasts_and_deletion():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:3000")

        # Check initial state
        try:
             page.wait_for_selector("#view-dashboard:not(.hidden)", timeout=5000)
             print("Dashboard loaded")
        except:
             print("Dashboard not visible, checking studio...")
             page.wait_for_selector("#view-studio:not(.hidden)", timeout=5000)
             print("Studio loaded (persisted state?)")
             page.click("#home-btn")
             page.wait_for_selector("#view-dashboard:not(.hidden)")
             print("Navigated to Dashboard")

        page.screenshot(path="verification/dashboard_initial.png")

        # --- Test 1: Toast on "Save Bible" ---

        # Setup dialog handler for New Project
        # We need to remove this listener later or ensure it only fires once if we want to add another for delete
        # Playwright listeners stack.

        def handle_new_project_dialog(dialog):
            print(f"Dialog opened: {dialog.message}")
            dialog.accept("Test Project 123")

        page.on("dialog", handle_new_project_dialog)

        # Click "New Project" card
        new_project_card = page.get_by_text("New Project")
        new_project_card.click()

        # Remove listener to avoid conflict with delete dialog later?
        # Playwright page.remove_listener is available but let's just be careful.
        page.remove_listener("dialog", handle_new_project_dialog)

        page.wait_for_selector("#view-studio:not(.hidden)")
        print("Entered Studio")

        # Open Bible
        page.click("#edit-bible-btn")
        page.wait_for_selector("#bible-modal:not(.hidden)")

        # Click "Save & Close" -> Should trigger Toast
        page.click("#save-bible-btn")

        # Wait for toast
        toast = page.wait_for_selector("#toast-container > div")
        print("Toast detected")

        page.screenshot(path="verification/toast_notification.png")

        # --- Test 2: Project Deletion (Deep Clean) ---
        # Go back to dashboard
        page.click("#home-btn")
        page.wait_for_selector("#view-dashboard:not(.hidden)")

        # Find our project "Test Project 123"
        proj_card = page.locator("#project-grid > div").filter(has_text="Test Project 123").first

        delete_btn = proj_card.locator(".delete-proj-btn")

        page.screenshot(path="verification/dashboard_before_delete.png")

        # Handle confirm dialog for delete
        def handle_delete_dialog(dialog):
            print(f"Delete Dialog: {dialog.message}")
            dialog.accept()

        page.on("dialog", handle_delete_dialog)

        # Use force=True
        delete_btn.click(force=True)

        # Wait a bit
        page.wait_for_timeout(1000)

        page.screenshot(path="verification/dashboard_after_delete.png")

        browser.close()

if __name__ == "__main__":
    verify_toasts_and_deletion()
