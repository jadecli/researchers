# Skill: Chrome Extract

Extract content from JavaScript-rendered pages using headless Chrome.

## When to Use

- The target page requires JavaScript to render content (SPAs, React, Vue, Angular)
- Standard HTTP requests return empty or incomplete HTML
- You need to interact with a page before extracting (click, scroll, wait)

## Instructions

1. Use the ChromeExtractor for page extraction:
   ```python
   from chrome.extract_with_chrome import ChromeExtractor

   with ChromeExtractor(headless=True, wait_for_js=True) as extractor:
       result = extractor.extract("https://example.com")
       print(result.title, len(result.text), len(result.links))
   ```

2. For Single Page Applications with multiple routes:
   ```python
   results = extractor.extract_spa_content(
       url="https://example.com",
       routes=["/about", "/products", "/contact"]
   )
   extractor.save_results(results, "output/spa")
   ```

3. For pages behind login forms, use FormAutomator:
   ```python
   from chrome.form_automation import FormAutomator

   with FormAutomator(headless=True) as automator:
       data = automator.login_and_extract(
           login_url="https://example.com/login",
           username="user@example.com",
           password="secret",
           target_url="https://example.com/dashboard"
       )
       print(data["page_text"])
   ```

4. For plugin marketplace submissions:
   ```python
   result = automator.fill_plugin_submission(
       submission_url="https://marketplace.example.com/submit",
       plugin_name="my-plugin",
       plugin_version="1.0.0",
       description="A useful plugin",
       entry_point="main.py"
   )
   ```

## Key Files

- `chrome/extract_with_chrome.py` -- ChromeExtractor class
- `chrome/form_automation.py` -- FormAutomator class

## Prerequisites

Either Playwright or Selenium must be installed:
```bash
pip install playwright && playwright install chromium
# or
pip install selenium
```

## Environment Variables

- `CHROME_PATH` -- path to Chrome/Chromium binary (optional, auto-detected)
