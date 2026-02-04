try:
    import playwright
    from playwright.async_api import async_playwright
    print("Playwright is installed.")
except ImportError:
    print("Playwright is MISSING.")
