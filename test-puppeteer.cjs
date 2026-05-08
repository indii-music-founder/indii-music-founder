const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  try {
    await page.goto('http://localhost:4242');
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
  }
  await browser.close();
})();
