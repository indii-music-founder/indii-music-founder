
from playwright.sync_api import sync_playwright

def verify_audio_analyzer():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to Tools page
        page.goto('http://localhost:4242/tools/audio-analyzer')

        # Take screenshot of initial state
        page.screenshot(path='verification/audio-analyzer-initial.png')

        browser.close()

if __name__ == '__main__':
    verify_audio_analyzer()
