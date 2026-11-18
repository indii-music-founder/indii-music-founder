#!/usr/bin/env node
/**
 * Regenerates the link-preview images in packages/landing/public/og/
 * (Artist Passport stages + home-page sections, 1200×630) with the same
 * Canvas share-card renderer the apps use, so previews always match the
 * in-app cards. Run after changing the share-card design or stage list:
 *
 *   node scripts/generate-og-images.mjs
 *
 * Set PLAYWRIGHT_CHROMIUM_PATH to use a specific Chromium binary.
 */
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shareDir = join(root, 'packages/shared/src/share');
const outDir = join(root, 'packages/landing/public/og');

const entry = `
import { buildShareCardModel } from ${JSON.stringify(join(shareDir, 'shareCardTemplates.ts'))};
import { renderShareCard } from ${JSON.stringify(join(shareDir, 'ShareCardRenderer.ts'))};
import { PASSPORT_SHARE_STAGES } from ${JSON.stringify(join(shareDir, 'passportShareCode.ts'))};
import { SITE_SECTIONS } from ${JSON.stringify(join(shareDir, 'siteSections.ts'))};
window.renderStages = async () => {
  const out = [];
  for (const stage of PASSPORT_SHARE_STAGES) {
    const model = buildShareCardModel(
      { kind: 'passport', stageBadge: stage.badge, stageTitle: stage.id, finding: 'Take the free Artist Passport', url: 'https://indii.music/passport' },
      { brandColors: ['#FFB800', '#E65100'] },
    );
    const { blob } = await renderShareCard(model, 'og');
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    out.push({ name: 'passport-' + stage.slug, dataUrl: canvas.toDataURL('image/jpeg', 0.86) });
  }
  for (const section of SITE_SECTIONS) {
    const model = buildShareCardModel(
      { kind: 'page', label: section.label, title: section.title, url: 'https://indii.music/s/' + section.id },
      { brandColors: ['#FFB800', '#2E2EFE'] },
    );
    const { blob } = await renderShareCard(model, 'og');
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    out.push({ name: 'section-' + section.id, dataUrl: canvas.toDataURL('image/jpeg', 0.86) });
  }
  return out;
};
`;

const bundle = await build({
    stdin: { contents: entry, resolveDir: root, loader: 'ts' },
    bundle: true,
    format: 'iife',
    write: false,
    logLevel: 'error',
});

const browser = await chromium.launch(
    process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
);
try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const images = await page.evaluate(() => window.renderStages());
    mkdirSync(outDir, { recursive: true });
    for (const { name, dataUrl } of images) {
        const file = join(outDir, `${name}.jpg`);
        writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
        console.log(`wrote ${file}`);
    }
} finally {
    await browser.close();
}
