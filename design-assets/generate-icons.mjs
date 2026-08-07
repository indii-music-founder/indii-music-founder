/**
 * indii icon family generator.
 *
 * Single source of truth for every tile colorway. Regenerate with:
 *   node design-assets/generate-icons.mjs
 *
 * Every colorway is the SAME recipe at a different hue — the recipe is taken
 * from the master brand green, so nothing in the family drifts lighter or more
 * saturated than the green and reads as "candy" beside it.
 *
 *   tile top    = hsl(H,      68%, 53%)
 *   tile bottom = hsl(H + 7,  83%, 24%)
 *   ink panel   = hsl(H,      60%,  6%)
 *   mark        = #3BEAF0 -> #12C6D4  (identical in every colorway)
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Tile gradient recipe, lifted from the master brand green. */
const RECIPE = {
    top: { s: 68, l: 53 },
    bottom: { s: 83, l: 24, hueShift: 7 },
    ink: { s: 60, l: 6 },
};

const MARK_LIGHT = '#3BEAF0';
const MARK_DARK = '#12C6D4';

/** Every colorway in the family, by hue. */
export const COLORWAYS = [
    { name: 'lime', hue: 95 },
    { name: 'grass', hue: 112 },
    { name: 'kelly', hue: 128 },
    { name: 'spring', hue: 141 },
    { name: 'emerald', hue: 155 },
    { name: 'jade', hue: 168 },
    { name: 'teal', hue: 190 },
    { name: 'azure', hue: 212 },
    { name: 'indigo', hue: 230 },
    { name: 'violet', hue: 252 },
    { name: 'purple', hue: 275 },
    { name: 'orchid', hue: 300 },
    { name: 'magenta', hue: 320 },
    { name: 'rose', hue: 338 },
];

/** Which colorway each shipping surface uses. */
export const SURFACES = [
    { file: 'favicon-web', colorway: 'spring' },
    { file: 'favicon-electron', colorway: 'indigo' },
    { file: 'favicon-remote', colorway: 'orchid' },
];

function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    s /= 100;
    l /= 100;
    const channel = (n) => {
        const k = (n + h * 12) % 12;
        const a = s * Math.min(l, 1 - l);
        return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    };
    return (
        '#' +
        [channel(0), channel(8), channel(4)]
            .map((v) => Math.round(v * 255).toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase()
    );
}

export function paletteFor(hue) {
    return {
        top: hslToHex(hue, RECIPE.top.s, RECIPE.top.l),
        bottom: hslToHex(hue + RECIPE.bottom.hueShift, RECIPE.bottom.s, RECIPE.bottom.l),
        ink: hslToHex(hue, RECIPE.ink.s, RECIPE.ink.l),
    };
}

export function renderIcon(id, { top, bottom, ink }) {
    return `<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="tile-${id}" x1="0" y1="0" x2="0" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${top}"/>
      <stop offset="100%" stop-color="${bottom}"/>
    </linearGradient>
    <linearGradient id="mark-${id}" x1="0" y1="126" x2="0" y2="386" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${MARK_LIGHT}"/>
      <stop offset="100%" stop-color="${MARK_DARK}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="115" fill="url(#tile-${id})"/>
  <rect x="72" y="72" width="368" height="368" rx="104" fill="${ink}" stroke="url(#mark-${id})" stroke-width="12"/>
  <circle cx="218" cy="155" r="29" fill="url(#mark-${id})"/>
  <circle cx="294" cy="155" r="29" fill="url(#mark-${id})"/>
  <rect x="189" y="208" width="58" height="178" rx="29" fill="url(#mark-${id})"/>
  <rect x="265" y="208" width="58" height="178" rx="29" fill="url(#mark-${id})"/>
</svg>
`;
}

const byName = new Map(COLORWAYS.map((c) => [c.name, c]));

mkdirSync(join(HERE, 'colorways'), { recursive: true });

for (const { name, hue } of COLORWAYS) {
    writeFileSync(join(HERE, 'colorways', `${name}.svg`), renderIcon(name, paletteFor(hue)));
}

for (const { file, colorway } of SURFACES) {
    const entry = byName.get(colorway);
    if (!entry) throw new Error(`Surface "${file}" references unknown colorway "${colorway}"`);
    writeFileSync(join(HERE, `${file}.svg`), renderIcon(colorway, paletteFor(entry.hue)));
}

console.log(`Wrote ${COLORWAYS.length} colorways + ${SURFACES.length} surface icons.`);
