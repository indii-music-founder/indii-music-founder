import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

async function exportDecksToPDF() {
    const workspacePath = path.resolve(process.env.HOME || '~', '.openclaw/workspace/marketing/pitch-deck');

    const decks = [
        'indiiOS-pitch-UNIFIED.html',
        'indiiOS-pitch-DISTRIBUTION.html',
        'indiiOS-pitch-BUSINESS-OS.html'
    ];

    console.log('Starting PDF Export for Pitch Decks...');

    const browser = await chromium.launch();
    const page = await browser.newPage();

    for (const deck of decks) {
        const htmlPath = path.join(workspacePath, deck);
        const pdfPath = path.join(workspacePath, deck.replace('.html', '.pdf'));

        if (!fs.existsSync(htmlPath)) {
            console.warn(`Warning: Could not find ${htmlPath}`);
            continue;
        }

        console.log(`Exporting ${deck} to PDF...`);
        await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });

        // Generate PDF with print styling
        await page.pdf({
            path: pdfPath,
            format: 'A4',
            landscape: true,
            printBackground: true,
            margin: {
                top: '0',
                right: '0',
                bottom: '0',
                left: '0'
            }
        });

        console.log(`✔ Successfully exported -> ${pdfPath}`);
    }

    await browser.close();
    console.log('All decks exported successfully!');
}

exportDecksToPDF().catch(console.error);
