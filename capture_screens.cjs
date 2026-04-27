const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  const screens = [
    { name: 'distro-real.png', url: '/distribution' },
    { name: 'creative-real.png', url: '/creative' },
    { name: 'audio-real.png', url: '/music' },
    { name: 'conductor-real.png', url: '/agent' },
    { name: 'dashboard-real.png', url: '/' },
    { name: 'legal-preview.png', url: '/legal' },
    { name: 'analytics-preview.png', url: '/analytics' },
    { name: 'creative-studio.png', url: '/creative/studio' },
    { name: 'publicist-preview.png', url: '/publicist' },
    { name: 'road-preview.png', url: '/road' },
  ];

  for (const s of screens) {
    console.log(`Capturing ${s.name}...`);
    try {
      await page.goto(`http://localhost:4242${s.url}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000); // wait for animations
      await page.screenshot({ path: `packages/landing/public/${s.name}` });
    } catch (e) {
      console.error(`Failed to capture ${s.name}:`, e.message);
    }
  }

  await browser.close();
})();
