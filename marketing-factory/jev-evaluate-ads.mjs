#!/usr/bin/env node
/**
 * TypeSafe System One (Jev) Test & Improve Runner for indii Marketing Ad Factory
 *
 * Evaluates every compiled cut in `marketing-factory/out/<campaignId>/scorecard-manifest.json`
 * using `jev-latest` via https://api.typesafe.ai/v1/systemone when `TYPESAFE_API_KEY`
 * is present (or the identical deterministic heuristic baseline when offline),
 * applies recommended `AdRefinementPatch` improvements, re-compiles improved HyperFrames
 * HTML cuts, and emits `jev-evaluation-report.json`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileAdMatrixVariant, compileProjectToHyperFrames } from '../packages/video-compiler/dist/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const campaignId = process.argv[2] || 'indii-launch-01';
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

const ACTION_CRITERIA = {
    none: 'Copy length, hook punch, safe-zone fit, and CTA are already strong for this shape and duration.',
    tighten_headline: 'Hook headline is too wordy for the opening 0-2s window and should be shortened to a punchier phrase.',
    increase_safe_margin: 'Copy risks crowding mobile platform UI chrome (Reels/TikTok right rail or bottom caption area); expand safe margins.',
    scale_down_font: 'Headline or CTA font size is too large relative to safe width and risks awkward multi-line wrapping.',
    tighten_cta: 'Call-to-action copy is too long or vague; tighten CTA for mobile tap conversion.',
};

const SCORE_CRITERIA = [
    'Very weak: unreadable, generic, or missing clear hook/CTA.',
    'Below average: awkward phrasing or weak mobile conversion pull.',
    'Adequate: clear message but lacks urgency or tight mobile pacing.',
    'Strong: punchy, readable on a phone, and clear value proposition.',
    'Exceptional: unmistakable 0-2s hook, crisp phone legibility, and compelling CTA.',
];

function buildPatch(action, state) {
    if (action === 'none') return undefined;
    if (action === 'increase_safe_margin') return { extraSafeMarginPct: 0.05, fontScaleMultiplier: 0.92 };
    if (action === 'scale_down_font') return { fontScaleMultiplier: 0.85, extraSafeMarginPct: 0.03 };
    if (action === 'tighten_headline') {
        const trimmed = state.hookHeadline.trim();
        const clauses = trimmed.split(/(?<=[.!?])\s+|\s+[—|]\s+/).filter(Boolean);
        const firstClause = clauses.length > 1 ? clauses[0].trim() : '';
        if (firstClause.length >= 12 && firstClause.length < trimmed.length) {
            return {
                fontScaleMultiplier: 0.9,
                extraSafeMarginPct: 0.03,
                headlineOverride: firstClause,
            };
        }
        return {
            fontScaleMultiplier: 0.86,
            extraSafeMarginPct: 0.04,
        };
    }
    if (action === 'tighten_cta') {
        const trimmed = state.ctaText.trim();
        const splitIdx = trimmed.search(/\s+(?:at|—)\s+/i);
        const leadClause = splitIdx > 0 ? trimmed.slice(0, splitIdx).trim() : '';
        if (leadClause.length >= 10 && leadClause.length < trimmed.length) {
            return {
                fontScaleMultiplier: 0.92,
                extraSafeMarginPct: 0.02,
                ctaOverride: leadClause,
            };
        }
        return {
            fontScaleMultiplier: 0.88,
            extraSafeMarginPct: 0.03,
        };
    }
    return undefined;
}

function heuristicEvaluate(state) {
    const headlineLen = state.hookHeadline.trim().length;
    const ctaLen = state.ctaText.trim().length;
    const estCharsPerLine = Math.max(10, Math.floor(state.safeWidthPx / (state.headlineFontSizePx * 0.56)));
    const estLines = headlineLen / estCharsPerLine;
    const isVertical = state.shape === '9:16';
    const overflowRisk = Math.min(1, Math.round((estLines > 3.2 ? 0.65 : estLines > 2.4 && isVertical ? 0.48 : 0.12) * 100) / 100);

    let recommendedAction = 'none';
    if (estLines > 3.2) recommendedAction = 'tighten_headline';
    else if (overflowRisk >= 0.45) recommendedAction = isVertical ? 'increase_safe_margin' : 'scale_down_font';
    else if (ctaLen > 38) recommendedAction = 'tighten_cta';

    const hookPunchScore = headlineLen <= 48 ? 9.0 : headlineLen <= 72 ? 8.2 : 7.0;
    const mobileCopyClarityScore = overflowRisk >= 0.45 ? 7.0 : 8.8;
    const ctaConversionScore = ctaLen > 0 && ctaLen <= 34 ? 8.8 : 7.4;
    const compositeScore = Math.round(((hookPunchScore + mobileCopyClarityScore + ctaConversionScore) / 3) * 10) / 10;

    return {
        hookPunchScore,
        mobileCopyClarityScore,
        ctaConversionScore,
        compositeScore,
        safeZoneOverflowRisk: overflowRisk,
        brandVoiceFit: 0.85,
        recommendedAction,
        suggestedPatch: buildPatch(recommendedAction, state),
        passesPreFlight: compositeScore >= 7.5 && overflowRisk < 0.45 && recommendedAction === 'none',
        source: 'heuristic',
    };
}

async function evaluateWithJev(state) {
    const apiKey = process.env.TYPESAFE_API_KEY?.trim();
    if (!apiKey) return heuristicEvaluate(state);

    const response = await fetch('https://api.typesafe.ai/v1/systemone', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: 'jev-latest',
            state,
            questions: {
                hook_punch_score: {
                    type: 'score',
                    instructions: 'Rate how immediately `hookHeadline` grabs attention in the 0-2s opening window for `channelLabel`.',
                    criteria: SCORE_CRITERIA,
                },
                mobile_copy_clarity_score: {
                    type: 'score',
                    instructions: 'Rate how effortlessly `hookHeadline` and `ctaText` read at phone width given `estimatedHeadlineLines`, `maxSafeHeadlineLines`, `estimatedCtaLines`, and `fitsWithinSafeZone`.',
                    criteria: SCORE_CRITERIA,
                },
                cta_conversion_score: {
                    type: 'score',
                    instructions: 'Rate how clear and conversion-oriented `ctaText` is for `durationSeconds`s.',
                    criteria: SCORE_CRITERIA,
                },
                safe_zone_overflow_risk: {
                    type: 'noul',
                    instructions: 'Given `estimatedHeadlineLines` vs `maxSafeHeadlineLines`, `estimatedCtaLines`, and `fitsWithinSafeZone`, does this cut risk overflowing or crowding mobile safe zones on `shape`?',
                    criteria: {
                        true: '`fitsWithinSafeZone` is false or lines risk crowding mobile safe zones.',
                        false: '`fitsWithinSafeZone` is true and copy fits cleanly inside the safe zone.',
                    },
                },
                brand_voice_fit: {
                    type: 'noul',
                    instructions: 'Does the copy tone fit `brandOrArtistName` and `brandVibe` without generic spam clichés?',
                    criteria: {
                        true: 'Matches brand/artist voice cleanly.',
                        false: 'Off-brand or spammy phrasing.',
                    },
                },
                recommended_refinement: {
                    type: 'choice',
                    instructions: 'Pick the single highest-leverage improvement action for this cut, or "none" if ready.',
                    criteria: ACTION_CRITERIA,
                },
            },
        }),
    });

    if (!response.ok) {
        console.warn(`TypeSafe API HTTP ${response.status} for ${state.variantId}; falling back to heuristic.`);
        return heuristicEvaluate(state);
    }

    const json = await response.json();
    const answers = json?.answers;
    if (!answers) return heuristicEvaluate(state);

    const toTen = s => Math.round(((s / 4) * 10) * 10) / 10;
    const hookPunchScore = toTen(answers.hook_punch_score?.score ?? 2);
    const mobileCopyClarityScore = toTen(answers.mobile_copy_clarity_score?.score ?? 2);
    const ctaConversionScore = toTen(answers.cta_conversion_score?.score ?? 2);
    const compositeScore = Math.round(((hookPunchScore + mobileCopyClarityScore + ctaConversionScore) / 3) * 10) / 10;
    const overflowRisk = answers.safe_zone_overflow_risk?.noul ?? 0.5;
    const brandVoiceFit = answers.brand_voice_fit?.noul ?? 0.5;
    const action = ACTION_CRITERIA[answers.recommended_refinement?.choice] ? answers.recommended_refinement.choice : 'none';

    return {
        hookPunchScore,
        mobileCopyClarityScore,
        ctaConversionScore,
        compositeScore,
        safeZoneOverflowRisk: overflowRisk,
        brandVoiceFit,
        recommendedAction: action,
        suggestedPatch: buildPatch(action, state),
        passesPreFlight: compositeScore >= 7.5 && overflowRisk < 0.45 && brandVoiceFit >= 0.6 && action === 'none',
        source: 'jev',
    };
}

function readCutStateFromProject(project, variantMeta) {
    const hookClip = project.clips.find(c => c.id.endsWith('_hook'));
    const ctaClip = project.clips.find(c => c.id.endsWith('_cta'));
    const hookHeadline = hookClip?.text ?? brief.hookHeadline;
    const ctaText = ctaClip?.text ?? brief.ctaText;
    const safeWidthPx = hookClip?.width ?? Math.round(project.width * 0.8);
    const headlineFontSizePx = hookClip?.fontSize ?? variantMeta.safeZone.baseHeadlineFontSize;
    const ctaFontSizePx = ctaClip?.fontSize ?? variantMeta.safeZone.baseCtaFontSize;
    const headlineCharCount = hookHeadline.trim().length;
    const ctaCharCount = ctaText.trim().length;
    const estCharsPerHeadlineLine = Math.max(10, Math.floor(safeWidthPx / (headlineFontSizePx * 0.54)));
    const estimatedHeadlineLines = Math.round((headlineCharCount / estCharsPerHeadlineLine) * 10) / 10;
    const estCharsPerCtaLine = Math.max(12, Math.floor(safeWidthPx / (ctaFontSizePx * 0.56)));
    const estimatedCtaLines = Math.round((ctaCharCount / estCharsPerCtaLine) * 10) / 10;
    const maxSafeHeadlineLines = variantMeta.shape === '9:16' || variantMeta.shape === '4:5' ? 2.5 : 2.2;
    const fitsWithinSafeZone = estimatedHeadlineLines <= maxSafeHeadlineLines && estimatedCtaLines <= 1.4;

    return {
        variantId: variantMeta.variantId,
        shape: variantMeta.shape,
        durationSeconds: variantMeta.durationSeconds,
        channelLabel: variantMeta.channelLabel,
        brandOrArtistName: manifest.brandOrArtistName,
        hookHeadline,
        subHeadline: brief.subHeadline ?? '',
        ctaText,
        safeWidthPx,
        headlineFontSizePx,
        ctaFontSizePx,
        headlineCharCount,
        ctaCharCount,
        estCharsPerHeadlineLine,
        estimatedHeadlineLines,
        estCharsPerCtaLine,
        estimatedCtaLines,
        maxSafeHeadlineLines,
        fitsWithinSafeZone,
        brandVibe: manifest.brandKit?.vibe ?? '',
    };
}

function readCutState(variantMeta) {
    const project = JSON.parse(fs.readFileSync(variantMeta.projectPath, 'utf8'));
    return readCutStateFromProject(project, variantMeta);
}

const results = [];
let improvedCount = 0;
let rolledBackCount = 0;

for (const variantMeta of manifest.variants) {
    const initialState = readCutState(variantMeta);
    const initialVerdict = await evaluateWithJev(initialState);
    let finalVerdict = initialVerdict;
    let improved = false;
    let rolledBackRegression = false;
    let appliedPatch = null;

    if (!initialVerdict.passesPreFlight && initialVerdict.suggestedPatch) {
        const candidatePatch = initialVerdict.suggestedPatch;
        const refinedVariant = compileAdMatrixVariant(
            brief,
            variantMeta.shape,
            variantMeta.durationSeconds,
            candidatePatch,
        );
        const refinedState = readCutStateFromProject(refinedVariant.project, variantMeta);
        const candidateVerdict = await evaluateWithJev(refinedState);

        // Regression rollback guard: never persist a cut that scored lower or added overflow risk
        const nonRegressing =
            candidateVerdict.compositeScore >= initialVerdict.compositeScore &&
            candidateVerdict.safeZoneOverflowRisk <= initialVerdict.safeZoneOverflowRisk + 0.05;

        if (nonRegressing) {
            const compiled = compileProjectToHyperFrames(refinedVariant.project);
            fs.writeFileSync(variantMeta.htmlPath, compiled.html, 'utf8');
            fs.writeFileSync(variantMeta.projectPath, JSON.stringify(refinedVariant.project, null, 2), 'utf8');
            appliedPatch = candidatePatch;
            finalVerdict = candidateVerdict;
            improved = true;
            improvedCount++;
        } else {
            rolledBackRegression = true;
            rolledBackCount++;
        }
    }

    results.push({
        variantId: variantMeta.variantId,
        shape: variantMeta.shape,
        durationSeconds: variantMeta.durationSeconds,
        initialVerdict,
        appliedPatch,
        finalVerdict,
        improved,
        rolledBackRegression,
    });
}

const report = {
    campaignId,
    systemOneModel: 'jev-latest',
    rubricModel: manifest.rubricModel,
    mode: process.env.TYPESAFE_API_KEY?.trim() ? 'live-jev' : 'deterministic-baseline',
    totalEvaluated: results.length,
    improvedCount,
    rolledBackCount,
    passedCount: results.filter(r => r.finalVerdict.passesPreFlight).length,
    results,
    evaluatedAtIso: new Date().toISOString(),
};

const reportPath = path.join(outDir, 'jev-evaluation-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
console.log(
    `Jev evaluation (${report.mode}) complete: ${report.totalEvaluated} cuts evaluated, ` +
    `${report.improvedCount} auto-improved, ${report.passedCount}/${report.totalEvaluated} passing pre-flight -> ${reportPath}`,
);
