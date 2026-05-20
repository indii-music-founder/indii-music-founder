import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOTS_DIR = "/tmp/indii_qa_screenshots";
if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const BASE_URL = "http://127.0.0.1:4243";

const MODULES_TO_TEST = [
    { id: "dashboard", expected: "conductor" },
    { id: "creative", expected: "creative" },
    { id: "marketing", expected: "marketing" },
    { id: "finance", expected: "finance" },
    { id: "distribution", expected: "distribution" },
    { id: "legal", expected: "legal" },
    { id: "social", expected: "social" }
];

async function getAgentName(page) {
    const selectors = [
        ".text-xs.font-bold.uppercase.tracking-widest",
        "[data-testid='agent-name']",
        ".agent-name"
    ];
    for (const sel of selectors) {
        try {
            const el = page.locator(sel).first();
            if (await el.isVisible()) {
                const text = await el.innerText();
                const cleaned = text.trim();
                if (cleaned && cleaned.length < 40) {
                    return cleaned;
                }
            }
        } catch (e) {
            // Ignore and try next
        }
    }
    return "(not found)";
}

async function run() {
    console.log("Starting Playwright Headless Browser QA...");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1400, height: 900 });

    console.log(`Loading initial page: ${BASE_URL}`);
    try {
        await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    } catch (err) {
        console.log("Initial load networkidle timed out, proceeding anyway...");
    }

    const initialScreenshot = path.join(SCREENSHOTS_DIR, "00_initial.png");
    await page.screenshot({ path: initialScreenshot });
    console.log(`Saved screenshot: ${initialScreenshot}`);

    // Check for login page content
    const bodyText = await page.innerText('body');
    if (bodyText.includes("Sign in") || bodyText.includes("Log in") || bodyText.includes("Password")) {
        console.log("⚠️ App is on a Login/Auth screen. Cannot test sidebar navigation without logging in.");
        await browser.close();
        return;
    }

    const results = [];
    for (const mod of MODULES_TO_TEST) {
        console.log(`Navigating to module: ${mod.id}`);
        try {
            await page.goto(`${BASE_URL}?module=${mod.id}`, { waitUntil: 'load', timeout: 15000 });
            await page.waitForTimeout(1500); // Wait for React state
        } catch (err) {
            console.log(`Navigation to ${mod.id} failed or timed out: ${err.message}`);
        }

        const scPath = path.join(SCREENSHOTS_DIR, `${mod.id}.png`);
        await page.screenshot({ path: scPath });
        console.log(`Saved screenshot: ${scPath}`);

        const foundAgent = await getAgentName(page);
        const match = foundAgent.toLowerCase().includes(mod.expected.toLowerCase()) ? "✅" : "❌";
        
        results.push({
            module: mod.id,
            expected: mod.expected,
            found: foundAgent,
            status: match
        });
    }

    console.log("\n==================================================");
    console.log("AGENT ALIGNMENT QA SUMMARY");
    console.log("==================================================");
    for (const r of results) {
        console.log(`${r.status} [${r.module}] Expected: ${r.expected} | Found: ${r.found}`);
    }
    console.log("==================================================");

    await browser.close();
}

run().catch(err => {
    console.error("Fatal QA script error:", err);
    process.exit(1);
});
