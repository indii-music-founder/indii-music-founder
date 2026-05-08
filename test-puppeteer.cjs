const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  try {
    await page.goto('http://localhost:4242');
    // CodeRabbit (PR #1707): waitForTimeout removed in Puppeteer v22 → use waitForNetworkIdle
    await page.waitForNetworkIdle();

    await page.waitForTimeout(2000);
    
    // Evaluate the number of text inputs on the page
    const inputs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input[type="text"], textarea')).map(el => ({
            tag: el.tagName,
            placeholder: el.getAttribute('placeholder'),
            className: el.className,
            closestForm: !!el.closest('form')
        }));
    });

    console.log(JSON.stringify(inputs, null, 2));
  } catch(e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    // CodeRabbit (PR #1707): browser.close() must be in finally to prevent Chromium process leaks
    await browser.close();
  }
    
    console.log(JSON.stringify(inputs, null, 2));
  } catch(e) {
    console.error(e);
  }
  await browser.close();
})();
