#!/usr/bin/env node
/**
 * Playwright Keyframe Capture & Gemini 4 Neon (/10) Multimodal Scorer
 * for the indii Autonomous Marketing & Ad Factory (Track 2).
 *
 * Usage:
 *   node marketing-factory/score-ads-gemini.mjs <campaignId> --capture-only
 *   GEMINI_API_KEY=... node marketing-factory/score-ads-gemini.mjs <campaignId>
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { GoogleGenAI } from '@google/genai';
import {
    compileAdMatrixVariant,
    compileProjectToHyperFrames,
} from '../packages/video-compiler/dist/index.js';

export const VIDEO_AD_PASS_THRESHOLD = 9.0;
export const MAX_CORRECTION_ATTEMPTS = 2;
export const DEFAULT_RUBRIC_MODEL = 'gemini-4-neon';

function clampScore(value) {
    const num = typeof value === 'number' && Number.isFinite(value) ? value : 0;
    return Math.round(Math.max(0, Math.min(10, num)) * 10) / 10;
}

function sanitizeRefinementPatch(rawPatch) {
    if (!rawPatch || typeof rawPatch !== 'object') {
        return undefined;
    }
    const patch = {};
    if (typeof rawPatch.fontScaleMultiplier === 'number' && Number.isFinite(rawPatch.fontScaleMultiplier)) {
        patch.fontScaleMultiplier =
            Math.round(Math.max(0.75, Math.min(1.25, rawPatch.fontScaleMultiplier)) * 100) / 100;
    }
    if (typeof rawPatch.extraSafeMarginPct === 'number' && Number.isFinite(rawPatch.extraSafeMarginPct)) {
        patch.extraSafeMarginPct =
            Math.round(Math.max(0, Math.min(0.1, rawPatch.extraSafeMarginPct)) * 1000) / 1000;
    }
    if (typeof rawPatch.headlineOverride === 'string' && rawPatch.headlineOverride.trim()) {
        patch.headlineOverride = rawPatch.headlineOverride.trim().slice(0, 160);
    }
    if (typeof rawPatch.ctaOverride === 'string' && rawPatch.ctaOverride.trim()) {
        patch.ctaOverride = rawPatch.ctaOverride.trim().slice(0, 80);
    }
    return Object.keys(patch).length > 0 ? patch : undefined;
}

/**
 * Clamp and enforce threshold invariants on a raw Gemini /10 ad scorecard.
 */
export function normalizeRubricScore(raw) {
    const overallScore = clampScore(raw?.overallScore);
    const overallPass = overallScore >= VIDEO_AD_PASS_THRESHOLD;
    const refinementPatch = sanitizeRefinementPatch(raw?.refinementPatch);

    return {
        firstTwoSecondHook: clampScore(raw?.firstTwoSecondHook),
        mobileLegibility: clampScore(raw?.mobileLegibility),
        safeZoneIntegrity: clampScore(raw?.safeZoneIntegrity),
        audioVisualPacing: clampScore(raw?.audioVisualPacing),
        brandAlignment: clampScore(raw?.brandAlignment),
        overallScore,
        overallPass,
        gapsFound:
            typeof raw?.gapsFound === 'string' && raw.gapsFound.trim()
                ? raw.gapsFound.trim()
                : overallPass
                    ? 'None'
                    : 'Below pass threshold',
        ...(refinementPatch ? { refinementPatch } : {}),
    };
}

/**
 * Build the Level 5 multimodal rubric prompt for a rendered ad variant.
 */
export function buildRubricPrompt({ variantId, shape, durationSeconds, briefSummary, brandKit }) {
    const lines = [
        `You are a strict Performance Creative Director evaluating a ${durationSeconds}s ${shape} video ad cut (${variantId}).`,
        `CAMPAIGN BRIEF: ${briefSummary}`,
        'Inspect the ordered PNG keyframes captured from headless Chromium (opening 0-2s hook, mid-body, CTA end-card).',
        'Return strict JSON with keys:',
        '{"firstTwoSecondHook":number,"mobileLegibility":number,"safeZoneIntegrity":number,"audioVisualPacing":number,"brandAlignment":number,"overallScore":number,"overallPass":boolean,"gapsFound":string,"refinementPatch":{"fontScaleMultiplier"?:number,"extraSafeMarginPct"?:number,"headlineOverride"?:string,"ctaOverride"?:string}}.',
        `Score each dimension 0-10 (decimals allowed). Set overallPass=true ONLY if overallScore >= ${VIDEO_AD_PASS_THRESHOLD.toFixed(1)} with zero safe-zone clipping or mobile legibility issues.`,
    ];
    if (brandKit) {
        lines.push(`BRAND KIT: ${JSON.stringify(brandKit)}`);
    }
    return lines.join('\n');
}

/**
 * Render an HTML composition in headless Chromium via Playwright at exact
 * target ad dimensions, seek animation timelines, and capture PNG keyframes.
 */
export async function captureHtmlKeyframes({
    htmlPath,
    width,
    height,
    checkpointsSec = [0.5, 1.5],
    outKeyframeDir,
}) {
    if (!fs.existsSync(htmlPath)) {
        throw new Error(`Composition HTML not found: ${htmlPath}`);
    }
    if (outKeyframeDir) {
        fs.mkdirSync(outKeyframeDir, { recursive: true });
    }

    const browser = await chromium.launch({ headless: true });
    try {
        const context = await browser.newContext({
            viewport: { width, height },
            deviceScaleFactor: 1,
        });
        const page = await context.newPage();
        await page.goto(pathToFileURL(path.resolve(htmlPath)).href, {
            waitUntil: 'domcontentloaded',
        });

        const frames = [];
        for (let i = 0; i < checkpointsSec.length; i += 1) {
            const sec = checkpointsSec[i];
            await page.evaluate(async (targetSec) => {
                const win = window;
                if (win.gsap?.globalTimeline && typeof win.gsap.globalTimeline.pause === 'function') {
                    win.gsap.globalTimeline.pause(targetSec);
                } else if (typeof win.__hfSeek === 'function') {
                    win.__hfSeek(targetSec);
                }
                await new Promise((resolve) =>
                    requestAnimationFrame(() => requestAnimationFrame(resolve)),
                );
            }, sec);

            const buffer = await page.screenshot({ type: 'png' });
            const base64 = buffer.toString('base64');
            let savedPath;
            if (outKeyframeDir) {
                const fileName = `frame-${String(i + 1).padStart(2, '0')}-${String(sec).replace('.', '_')}s.png`;
                savedPath = path.join(outKeyframeDir, fileName);
                fs.writeFileSync(savedPath, buffer);
            }
            frames.push({
                checkpointSec: sec,
                mimeType: 'image/png',
                base64,
                ...(savedPath ? { savedPath } : {}),
            });
        }
        return frames;
    } finally {
        await browser.close();
    }
}

/**
 * Evaluate captured keyframes via @google/genai (`gemini-4-neon` by default).
 */
export async function scoreKeyframesWithGemini({
    apiKey,
    model = process.env.INDII_RUBRIC_MODEL || DEFAULT_RUBRIC_MODEL,
    prompt,
    frames,
}) {
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY or GOOGLE_API_KEY is required for live Gemini rubric scoring.');
    }
    const ai = new GoogleGenAI({ apiKey });
    const parts = [
        { text: prompt },
        ...frames.map((frame) => ({
            inlineData: {
                mimeType: frame.mimeType || 'image/png',
                data: frame.base64,
            },
        })),
    ];

    const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts }],
        config: {
            responseMimeType: 'application/json',
            temperature: 1.0,
            maxOutputTokens: 1024,
        },
    });

    const text = response.text ?? '';
    const decoded = JSON.parse(text);
    return normalizeRubricScore(decoded);
}

/**
 * Run bounded auto-redo (<= MAX_CORRECTION_ATTEMPTS) with regression rollback.
 */
export async function evaluateVariantWithAutoRedo({
    variantId,
    captureKeyframes,
    scoreKeyframes,
    recompileVariant,
    takeSnapshot,
    restoreSnapshot,
}) {
    const history = [];
    const appliedPatches = [];
    let bestScore = null;
    let bestSnapshot = null;
    let previousScore = null;
    let discardedForRegression = false;

    for (let attempt = 0; attempt <= MAX_CORRECTION_ATTEMPTS; attempt += 1) {
        const snapshot = takeSnapshot();
        const frames = await captureKeyframes(attempt);
        const score = await scoreKeyframes(frames, attempt);

        history.push({
            attempt,
            overallScore: score.overallScore,
            overallPass: score.overallPass,
            gapsFound: score.gapsFound,
        });

        if (!bestScore || score.overallScore >= bestScore.overallScore) {
            bestScore = score;
            bestSnapshot = snapshot;
        }

        if (score.overallPass) {
            return {
                variantId,
                approved: true,
                discardedForRegression: false,
                attemptsUsed: appliedPatches.length,
                bestScore: score,
                appliedPatches,
                history,
            };
        }

        if (previousScore !== null && score.overallScore < previousScore) {
            discardedForRegression = true;
            if (bestSnapshot !== null) {
                restoreSnapshot(bestSnapshot);
            }
            break;
        }
        previousScore = score.overallScore;

        if (attempt >= MAX_CORRECTION_ATTEMPTS) {
            break;
        }

        const patch = score.refinementPatch ?? {
            fontScaleMultiplier: 0.9,
            extraSafeMarginPct: 0.04,
        };
        appliedPatches.push(patch);
        await recompileVariant(patch, attempt + 1);
    }

    return {
        variantId,
        approved: false,
        discardedForRegression,
        attemptsUsed: appliedPatches.length,
        bestScore,
        appliedPatches,
        history,
    };
}

async function runCli() {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const args = process.argv.slice(2);
    const captureOnly = args.includes('--capture-only');
    const campaignId = args.find((a) => !a.startsWith('--')) || 'indii-launch-01';

    const outDir = path.join(__dirname, 'out', campaignId);
    const manifestPath = path.join(outDir, 'scorecard-manifest.json');
    const briefPath = path.join(__dirname, 'campaigns', `${campaignId}.json`);

    if (!fs.existsSync(manifestPath)) {
        console.error(`Manifest not found: ${manifestPath}. Run run-ad-factory.mjs first.`);
        process.exit(1);
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const brief = fs.existsSync(briefPath)
        ? JSON.parse(fs.readFileSync(briefPath, 'utf8'))
        : {
              campaignId: manifest.campaignId,
              title: manifest.title,
              brandOrArtistName: manifest.brandOrArtistName,
              hookHeadline: manifest.title,
              ctaText: 'Learn more',
              verticalFootageUrl: '',
          };

    if (captureOnly) {
        const captured = [];
        for (const variant of manifest.variants) {
            const keyframeDir = path.join(outDir, variant.variantId, 'keyframes');
            const frames = await captureHtmlKeyframes({
                htmlPath: variant.htmlPath,
                width: variant.dimensions.width,
                height: variant.dimensions.height,
                checkpointsSec: variant.scoringCheckpointsSec,
                outKeyframeDir: keyframeDir,
            });
            captured.push({
                variantId: variant.variantId,
                shape: variant.shape,
                durationSeconds: variant.durationSeconds,
                keyframes: frames.map((f) => ({
                    checkpointSec: f.checkpointSec,
                    savedPath: f.savedPath,
                    byteLength: Buffer.from(f.base64, 'base64').length,
                })),
            });
        }
        const captureReportPath = path.join(outDir, 'keyframe-capture-report.json');
        fs.writeFileSync(
            captureReportPath,
            JSON.stringify(
                {
                    campaignId,
                    mode: 'capture-only',
                    variantCount: captured.length,
                    variants: captured,
                    capturedAtIso: new Date().toISOString(),
                },
                null,
                2,
            ),
            'utf8',
        );
        console.log(`Captured PNG keyframes for ${captured.length} variants -> ${captureReportPath}`);
        return;
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    if (!apiKey) {
        console.error(
            'Missing GEMINI_API_KEY / GOOGLE_API_KEY. Set an API key for Gemini 4 Neon scoring, or pass --capture-only for Playwright PNG capture.',
        );
        process.exit(1);
    }

    const model = process.env.INDII_RUBRIC_MODEL || manifest.rubricModel || DEFAULT_RUBRIC_MODEL;
    const results = [];

    for (const variant of manifest.variants) {
        const keyframeDir = path.join(outDir, variant.variantId, 'keyframes');
        const result = await evaluateVariantWithAutoRedo({
            variantId: variant.variantId,
            captureKeyframes: (attempt) =>
                captureHtmlKeyframes({
                    htmlPath: variant.htmlPath,
                    width: variant.dimensions.width,
                    height: variant.dimensions.height,
                    checkpointsSec: variant.scoringCheckpointsSec,
                    outKeyframeDir: path.join(keyframeDir, `attempt-${attempt}`),
                }),
            scoreKeyframes: (frames) =>
                scoreKeyframesWithGemini({
                    apiKey,
                    model,
                    prompt: buildRubricPrompt({
                        variantId: variant.variantId,
                        shape: variant.shape,
                        durationSeconds: variant.durationSeconds,
                        briefSummary: `${brief.title}: ${brief.hookHeadline} (${brief.ctaText})`,
                        brandKit: manifest.brandKit,
                    }),
                    frames,
                }),
            recompileVariant: async (patch) => {
                const refined = compileAdMatrixVariant(
                    brief,
                    variant.shape,
                    variant.durationSeconds,
                    patch,
                );
                const compiled = compileProjectToHyperFrames(refined.project);
                fs.writeFileSync(variant.htmlPath, compiled.html, 'utf8');
                fs.writeFileSync(variant.projectPath, JSON.stringify(refined.project, null, 2), 'utf8');
            },
            takeSnapshot: () => ({
                html: fs.readFileSync(variant.htmlPath, 'utf8'),
                project: fs.readFileSync(variant.projectPath, 'utf8'),
            }),
            restoreSnapshot: (snapshot) => {
                fs.writeFileSync(variant.htmlPath, snapshot.html, 'utf8');
                fs.writeFileSync(variant.projectPath, snapshot.project, 'utf8');
            },
        });
        results.push(result);
    }

    const reportPath = path.join(outDir, 'gemini-scorecard-report.json');
    fs.writeFileSync(
        reportPath,
        JSON.stringify(
            {
                campaignId,
                rubricModel: model,
                passThreshold: VIDEO_AD_PASS_THRESHOLD,
                approvedCount: results.filter((r) => r.approved).length,
                totalVariants: results.length,
                results,
                evaluatedAtIso: new Date().toISOString(),
            },
            null,
            2,
        ),
        'utf8',
    );
    console.log(
        `Gemini (${model}) evaluated ${results.length} variants (${results.filter((r) => r.approved).length}/${results.length} approved) -> ${reportPath}`,
    );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    runCli().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
