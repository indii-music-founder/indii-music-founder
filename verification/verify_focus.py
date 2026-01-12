from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()
    page.goto('http://localhost:5174')

    # Wait for the carousel to appear
    page.wait_for_selector('text=Candidates Carousel Demo')

    # Press Tab to focus the first button
    page.keyboard.press('Tab') # Focus start button
    page.keyboard.press('Tab') # Focus close button
    page.keyboard.press('Tab') # Focus first candidate (if order is correct, or shift-tab)

    # Note: CandidatesCarousel renders absolute, so tab order might be tricky.
    # Let's target the candidate select button directly and focus it to see if it becomes visible.

    # Target the first candidate select button
    btn = page.locator('[data-testid="candidate-select-btn-0"]')
    btn.focus()

    # Take screenshot while focused
    page.screenshot(path='verification/focused_state.png')

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
