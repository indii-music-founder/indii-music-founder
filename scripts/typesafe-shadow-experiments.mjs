#!/usr/bin/env node
/**
 * typesafe-shadow-experiments.mjs — shadow-mode experiments for the P1 TypeSafe
 * candidates identified in the 2026-09-22 UI/heuristic audits.
 *
 * Measures, on labeled fixtures, the agreement of TypeSafe System One (jev)
 * judgments against (a) ground truth and (b) the shipped deterministic
 * heuristics, plus token/latency cost. Evidence class: local-real (live API,
 * synthetic fixtures) — NOT production proof.
 *
 * Usage:  TYPESAFE_API_KEY=... node scripts/typesafe-shadow-experiments.mjs
 * Output: console summary + .agent/observations/typesafe-shadow-experiments.{json,md}
 * The API key is never printed and never written to any output file.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const API_KEY = process.env.TYPESAFE_API_KEY || '';
if (!API_KEY) {
    console.error('TYPESAFE_API_KEY is required (export it or source .env).');
    process.exit(1);
}
const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const MODEL = 'jev-latest';
const OBS_DIR = '.agent/observations';

// ---------------------------------------------------------------------------
// Experiment A — foundry column semantics
// Ground truth uses the InferredFieldSemantic enum (packages/shared/src/foundry/types.ts).
// ---------------------------------------------------------------------------
const SEMANTIC_ENUM = [
    'isrc', 'upc', 'iswc', 'currency_amount', 'quantity_count', 'stream_count',
    'download_count', 'iso_date', 'us_date', 'territory_code', 'track_title',
    'artist_name', 'album_title', 'dsp_name', 'transaction_type',
    'fee_amount', 'generic_text', 'generic_number',
];

const COLUMN_FIXTURES = [
    { header: 'ISRC', samples: ['USABC2600001', 'USDEF2600002'], truth: 'isrc' },
    { header: 'UPC', samples: ['123456789012'], truth: 'upc' },
    { header: 'Fee Amount', samples: ['0.50', '1.25'], truth: 'fee_amount' },            // baseline trap
    { header: 'Net Receipts', samples: ['1234.56'], truth: 'currency_amount' },          // baseline miss
    { header: 'Units', samples: ['1000', '2500'], truth: 'quantity_count' },
    { header: 'Sales Month', samples: ['March 2026'], truth: 'us_date' },                // baseline emits iso_date
    { header: 'Reporting Date', samples: ['2026-03-01'], truth: 'iso_date' },
    { header: 'Territory', samples: ['DE', 'FR'], truth: 'territory_code' },
    { header: 'Store', samples: ['Spotify', 'Apple Music'], truth: 'dsp_name' },
    { header: 'Artist', samples: ['Artist B'], truth: 'artist_name' },
    { header: 'Track Title', samples: ['Song A'], truth: 'track_title' },
    { header: 'Album Title', samples: ['The Album'], truth: 'album_title' },
    { header: 'Transaction Type', samples: ['STREAM', 'DOWNLOAD'], truth: 'transaction_type' }, // baseline miss
    { header: 'ISWC', samples: ['T-034524380-1'], truth: 'iswc' },                       // baseline miss
    { header: 'Streams', samples: ['5000', '12000'], truth: 'stream_count' },            // baseline says quantity_count
    { header: 'Downloads', samples: ['120', '300'], truth: 'download_count' },           // baseline says quantity_count
];

/** Faithful mirror of FormatForensicsEngine.inferSemantic (ordered rules) as of ff5acadce. */
function baselineInferSemantic(headerRaw, samples) {
    const header = headerRaw.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const isrc = /^[A-Z]{2}-?[A-Z0-9]{3}-?[0-9]{2}-?[0-9]{5}$/i;
    const upc = /^\d{12,14}$/;
    const iso = /^\d{4}-\d{2}(-\d{2})?$/;
    const num = /^-?\$?\d+(\.\d+)?$/;
    if (header.includes('isrc') || samples.some((v) => isrc.test(v))) return 'isrc';
    if (header.includes('upc') || header.includes('ean') || header.includes('icpn') || samples.some((v) => upc.test(v))) return 'upc';
    if (header.includes('fee') || header.includes('withholding') || header.includes('tax')) return 'fee_amount';
    if (header.includes('earning') || header.includes('revenue') || header.includes('total_earned') || header.includes('subtotal') || header.includes('usd') || header.includes('amount')) return 'currency_amount';
    if (header.includes('quantity') || header.includes('units') || header.includes('stream') || header.includes('plays')) return 'quantity_count';
    if (header.includes('date') || header.includes('period') || header.includes('month') || samples.some((v) => iso.test(v))) return 'iso_date';
    if (header.includes('country') || header.includes('territory') || samples.every((v) => /^[A-Z]{2}$/i.test(v))) return 'territory_code';
    if (header.includes('store') || header.includes('dsp') || header.includes('service') || header.includes('partner') || header.includes('platform')) return 'dsp_name';
    if (header === 'title' || header === 'song_title' || header === 'track_title' || header === 'song') return 'track_title';
    if (header.includes('artist') || header.includes('performer')) return 'artist_name';
    if (samples.length > 0 && samples.every((v) => num.test(v))) return 'generic_number';
    return 'generic_text';
}

// ---------------------------------------------------------------------------
// Experiment B — sync mood classification
// Ground truth per the SyncMood taxonomy; [] means "no standard mood applies".
// ---------------------------------------------------------------------------
const MOOD_ENUM = ['Cinematic', 'Upbeat', 'Energetic', 'Melancholic', 'Dark', 'Chill', 'Romantic', 'Triumphant'];

const MOOD_FIXTURES = [
    { mood: 'happy', truth: ['Upbeat'] },
    { mood: 'unhappy', truth: [] },                          // trap: substring pass said Upbeat
    { mood: 'lovelorn', truth: [] },                         // trap: substring pass said Romantic
    { mood: 'dark-pop', truth: ['Dark'] },
    { mood: 'epic orchestral', truth: ['Cinematic'] },
    { mood: 'chill', truth: ['Chill'] },
    { mood: 'somber sad piano', truth: ['Melancholic'] },
    { mood: 'hype', truth: ['Energetic'] },
    { mood: 'experimental industrial glitched noise', truth: [] },
    { mood: 'romantic dinner jazz', truth: ['Romantic'] },
];

/** Mirror of the shipped (post-ISSUE-1443) mapToSyncMoods matching. */
const MOOD_MAP = {
    cinematic: 'Cinematic', epic: 'Cinematic', orchestral: 'Cinematic', atmospheric: 'Cinematic', dramatic: 'Cinematic',
    upbeat: 'Upbeat', happy: 'Upbeat', joyful: 'Upbeat',
    energetic: 'Energetic', hype: 'Energetic', driving: 'Energetic', aggressive: 'Energetic',
    melancholic: 'Melancholic', sad: 'Melancholic', somber: 'Melancholic', reflective: 'Melancholic',
    dark: 'Dark', eerie: 'Dark', ominous: 'Dark', spooky: 'Dark',
    chill: 'Chill', relaxed: 'Chill', calm: 'Chill', smooth: 'Chill',
    romantic: 'Romantic', sensual: 'Romantic', love: 'Romantic',
    triumphant: 'Triumphant', heroic: 'Triumphant', victorious: 'Triumphant', proud: 'Triumphant',
};
function baselineMapToSyncMoods(list) {
    const out = new Set();
    for (const mood of list) {
        const n = mood.toLowerCase().trim();
        if (MOOD_MAP[n]) { out.add(MOOD_MAP[n]); continue; }
        for (const [k, v] of Object.entries(MOOD_MAP)) {
            if (new RegExp(`\\b${k}\\b`).test(n)) out.add(v);
        }
    }
    return out.size ? [...out] : [];
}

// ---------------------------------------------------------------------------
// TypeSafe client (raw fetch, house style — no SDK)
// ---------------------------------------------------------------------------
let totalInputTokens = 0;
let totalOutputTokens = 0;
let totalMs = 0;

async function judge(state, questions) {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ state, questions, model: MODEL }),
            signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        const json = await res.json();
        const ms = Date.now() - started;
        totalMs += ms;
        totalInputTokens += json.usage?.input_tokens ?? 0;
        totalOutputTokens += json.usage?.output_tokens ?? 0;
        return { answers: json.answers, usage: json.usage, ms };
    } finally {
        clearTimeout(timer);
    }
}

// ---------------------------------------------------------------------------
// Experiments
// ---------------------------------------------------------------------------
async function runColumnExperiment() {
    const rows = [];
    for (const fixture of COLUMN_FIXTURES) {
        const criteria = {};
        for (const value of SEMANTIC_ENUM) {
            criteria[value] = `The column is ${value.replace(/_/g, ' ')}.`;
        }
        criteria.generic_text += ' Nothing more specific applies.';
        const { answers, ms } = await judge(
            { header: fixture.header, sample_values: fixture.samples },
            {
                semantic: {
                    type: 'choice',
                    instructions: {
                        task: 'A music distributor royalty statement has a column with this header and these sample values. Which semantic field does the column represent?',
                        header: fixture.header,
                    },
                    criteria,
                },
            },
        );
        const a = answers.semantic;
        const jev = a?.choice ?? '(error)';
        const baseline = baselineInferSemantic(fixture.header, fixture.samples);
        rows.push({
            header: fixture.header,
            truth: fixture.truth,
            baseline,
            jev,
            jev_confidence: a?.confidence ?? null,
            baseline_correct: baseline === fixture.truth,
            jev_correct: jev === fixture.truth,
            ms,
        });
    }
    return rows;
}

async function runMoodExperiment() {
    const rows = [];
    for (const fixture of MOOD_FIXTURES) {
        const criteria = {};
        for (const mood of MOOD_ENUM) criteria[mood] = `The tag expresses a ${mood} mood.`;
        criteria.none = 'The tag expresses no recognizable mood from the list.';
        const { answers, ms } = await judge(
            { ai_mood_tag: fixture.mood },
            {
                mood: {
                    type: 'choice',
                    instructions: {
                        task: 'A music AI tagged a track with this mood string. Which single standardized sync-licensing mood matches it best? If the string expresses no recognizable mood, choose none.',
                        tag: fixture.mood,
                    },
                    criteria,
                },
            },
        );
        const a = answers.mood;
        const jev = a?.choice && a.choice !== 'none' ? [a.choice] : [];
        const baseline = baselineMapToSyncMoods([fixture.mood]);
        const sameSet = (x, y) => x.length === y.length && x.every((m) => y.includes(m));
        rows.push({
            mood: fixture.mood,
            truth: fixture.truth,
            baseline,
            jev,
            jev_confidence: a?.confidence ?? null,
            baseline_correct: sameSet(baseline, fixture.truth),
            jev_correct: sameSet(jev, fixture.truth),
            ms,
        });
    }
    return rows;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function summarize(rows, label) {
    const n = rows.length;
    const baselineCorrect = rows.filter((r) => r.baseline_correct).length;
    const jevCorrect = rows.filter((r) => r.jev_correct).length;
    const payoff = rows.filter((r) => !r.baseline_correct && r.jev_correct);
    const regressions = rows.filter((r) => r.baseline_correct && !r.jev_correct);
    return { label, n, baselineCorrect, jevCorrect, payoff, regressions };
}

const columnRows = await runColumnExperiment();
const moodRows = await runMoodExperiment();
const columnSummary = summarize(columnRows, 'foundry column semantics');
const moodSummary = summarize(moodRows, 'sync mood classification');

const results = {
    generatedAt: new Date().toISOString(),
    model: MODEL,
    evidenceClass: 'local-real (live API, labeled synthetic fixtures) — not production proof',
    experiments: { columns: columnRows, moods: moodRows },
    summaries: {
        columns: {
            fixtures: columnSummary.n,
            baseline_correct: columnSummary.baselineCorrect,
            jev_correct: columnSummary.jevCorrect,
            jev_fixes_baseline: columnSummary.payoff.map((r) => r.header),
            jev_regressions_vs_baseline: columnSummary.regressions.map((r) => r.header),
        },
        moods: {
            fixtures: moodSummary.n,
            baseline_correct: moodSummary.baselineCorrect,
            jev_correct: moodSummary.jevCorrect,
            jev_fixes_baseline: moodSummary.payoff.map((r) => r.mood),
            jev_regressions_vs_baseline: moodSummary.regressions.map((r) => r.mood),
        },
    },
    cost: { input_tokens: totalInputTokens, output_tokens: totalOutputTokens, total_requests: columnRows.length + moodRows.length, total_ms: totalMs },
};

mkdirSync(OBS_DIR, { recursive: true });
writeFileSync(join(OBS_DIR, 'typesafe-shadow-experiments.json'), JSON.stringify(results, null, 2) + '\n');

const md = [`# TypeSafe shadow experiments — ${results.generatedAt}`, '',
    `Evidence class: **${results.evidenceClass}** · model \`${MODEL}\` · ${results.cost.total_requests} requests · ${results.cost.input_tokens} in / ${results.cost.output_tokens} out tokens · ${(results.cost.total_ms / 1000).toFixed(1)}s total`, '',
    `## A. Foundry column semantics (${columnSummary.n} fixtures)`, '',
    `| header | truth | shipped baseline | jev | jev conf |`, '|---|---|---|---|---|',
    ...columnRows.map((r) => `| ${r.header} | ${r.truth} | ${r.baseline}${r.baseline_correct ? ' ✓' : ' ✗'} | ${r.jev}${r.jev_correct ? ' ✓' : ' ✗'} | ${r.jev_confidence ?? '-'} |`), '',
    `Baseline ${columnSummary.baselineCorrect}/${columnSummary.n} · Jev ${columnSummary.jevCorrect}/${columnSummary.n}`,
    `Jev fixes baseline: ${columnSummary.payoff.map((r) => `\`${r.header}\``).join(', ') || '—'}`,
    `Jev regressions: ${columnSummary.regressions.map((r) => `\`${r.header}\``).join(', ') || '—'}`, '',
    `## B. Sync mood classification (${moodSummary.n} fixtures)`, '',
    `| tag | truth | shipped baseline | jev | jev conf |`, '|---|---|---|---|---|',
    ...moodRows.map((r) => `| ${r.mood} | [${r.truth.join(',') || '∅'}] | [${r.baseline.join(',') || '∅'}]${r.baseline_correct ? ' ✓' : ' ✗'} | [${r.jev.join(',') || '∅'}]${r.jev_correct ? ' ✓' : ' ✗'} | ${r.jev_confidence ?? '-'} |`), '',
    `Baseline ${moodSummary.baselineCorrect}/${moodSummary.n} · Jev ${moodSummary.jevCorrect}/${moodSummary.n}`,
    `Jev fixes baseline: ${moodSummary.payoff.map((r) => `\`${r.mood}\``).join(', ') || '—'}`,
    `Jev regressions: ${moodSummary.regressions.map((r) => `\`${r.mood}\``).join(', ') || '—'}`, ''].join('\n');
writeFileSync(join(OBS_DIR, 'typesafe-shadow-experiments.md'), md + '\n');

console.log(md);
console.log(`\nArtifacts: ${OBS_DIR}/typesafe-shadow-experiments.{md,json}`);
