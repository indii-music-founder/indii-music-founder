import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
    VIDEO_AD_PASS_THRESHOLD,
    normalizeRubricScore,
    evaluateVariantWithAutoRedo,
    captureHtmlKeyframes,
} from './score-ads-gemini.mjs';

test('normalizeRubricScore clamps dimension scores, enforces >= 9.0 pass gate, and bounds refinementPatch', () => {
    const normalized = normalizeRubricScore({
        firstTwoSecondHook: 11.4,
        mobileLegibility: -1.2,
        safeZoneIntegrity: 8.6,
        audioVisualPacing: 8.8,
        brandAlignment: 8.9,
        overallScore: 8.74,
        overallPass: true,
        gapsFound: 'CTA slightly near bottom chrome.',
        refinementPatch: {
            fontScaleMultiplier: 1.8,
            extraSafeMarginPct: 0.25,
            headlineOverride: '  DROP FRIDAY  ',
            ctaOverride: '  STREAM NOW  ',
        },
    });

    assert.equal(normalized.firstTwoSecondHook, 10);
    assert.equal(normalized.mobileLegibility, 0);
    assert.equal(normalized.overallScore, 8.7);
    assert.equal(normalized.overallPass, false);
    assert.deepEqual(normalized.refinementPatch, {
        fontScaleMultiplier: 1.25,
        extraSafeMarginPct: 0.1,
        headlineOverride: 'DROP FRIDAY',
        ctaOverride: 'STREAM NOW',
    });

    const passing = normalizeRubricScore({
        firstTwoSecondHook: 9.5,
        mobileLegibility: 9.4,
        safeZoneIntegrity: 9.6,
        audioVisualPacing: 9.2,
        brandAlignment: 9.3,
        overallScore: 9.4,
        overallPass: false,
        gapsFound: 'None',
    });
    assert.equal(passing.overallScore >= VIDEO_AD_PASS_THRESHOLD, true);
    assert.equal(passing.overallPass, true);
});

test('evaluateVariantWithAutoRedo approves >= 9.0 immediately, refines 8.6 -> 9.4, and restores snapshot on regression', async () => {
    // 1) Immediate pass
    const passImmediate = await evaluateVariantWithAutoRedo({
        variantId: 'cut_9x16_15s',
        captureKeyframes: async () => [{ checkpointSec: 0.5, base64: 'frame0' }],
        scoreKeyframes: async () =>
            normalizeRubricScore({
                firstTwoSecondHook: 9.4,
                mobileLegibility: 9.3,
                safeZoneIntegrity: 9.5,
                audioVisualPacing: 9.1,
                brandAlignment: 9.2,
                overallScore: 9.3,
                overallPass: true,
                gapsFound: 'None',
            }),
        recompileVariant: async () => {
            throw new Error('Should not recompile when attempt 0 passes');
        },
        takeSnapshot: () => ({ html: 'a' }),
        restoreSnapshot: () => {
            throw new Error('Should not restore when attempt 0 passes');
        },
    });

    assert.equal(passImmediate.approved, true);
    assert.equal(passImmediate.attemptsUsed, 0);
    assert.equal(passImmediate.discardedForRegression, false);
    assert.equal(passImmediate.bestScore.overallScore, 9.3);

    // 2) Auto-refinement 8.6 -> 9.4
    let callCount = 0;
    const patchesSeen = [];
    const refinedPass = await evaluateVariantWithAutoRedo({
        variantId: 'cut_1x1_15s',
        captureKeyframes: async () => [{ checkpointSec: 0.5, base64: `frame-${callCount}` }],
        scoreKeyframes: async () => {
            callCount += 1;
            if (callCount === 1) {
                return normalizeRubricScore({
                    firstTwoSecondHook: 8.8,
                    mobileLegibility: 8.2,
                    safeZoneIntegrity: 8.5,
                    audioVisualPacing: 8.9,
                    brandAlignment: 8.6,
                    overallScore: 8.6,
                    overallPass: false,
                    gapsFound: 'Headline crowds top margin.',
                    refinementPatch: { fontScaleMultiplier: 0.9, extraSafeMarginPct: 0.04 },
                });
            }
            return normalizeRubricScore({
                firstTwoSecondHook: 9.5,
                mobileLegibility: 9.4,
                safeZoneIntegrity: 9.6,
                audioVisualPacing: 9.3,
                brandAlignment: 9.4,
                overallScore: 9.4,
                overallPass: true,
                gapsFound: 'None',
            });
        },
        recompileVariant: async (patch) => {
            patchesSeen.push(patch);
        },
        takeSnapshot: () => ({ html: `snap-${callCount}` }),
        restoreSnapshot: () => {
            throw new Error('Should not rollback on improving refinement');
        },
    });

    assert.equal(refinedPass.approved, true);
    assert.equal(refinedPass.attemptsUsed, 1);
    assert.equal(patchesSeen.length, 1);
    assert.equal(refinedPass.bestScore.overallScore, 9.4);

    // 3) Regression rollback 8.7 -> 8.1
    let regressionRound = 0;
    let restoredSnapshot = null;
    const regressed = await evaluateVariantWithAutoRedo({
        variantId: 'cut_4x5_15s',
        captureKeyframes: async () => [{ checkpointSec: 0.5, base64: `reg-${regressionRound}` }],
        scoreKeyframes: async () => {
            regressionRound += 1;
            const scoreVal = regressionRound === 1 ? 8.7 : 8.1;
            return normalizeRubricScore({
                firstTwoSecondHook: scoreVal,
                mobileLegibility: scoreVal,
                safeZoneIntegrity: scoreVal,
                audioVisualPacing: scoreVal,
                brandAlignment: scoreVal,
                overallScore: scoreVal,
                overallPass: false,
                gapsFound: regressionRound === 1 ? 'Needs margin adjustment' : 'Got worse',
                refinementPatch: { extraSafeMarginPct: 0.05 },
            });
        },
        recompileVariant: async () => {},
        takeSnapshot: () => ({ round: regressionRound }),
        restoreSnapshot: (snap) => {
            restoredSnapshot = snap;
        },
    });

    assert.equal(regressed.approved, false);
    assert.equal(regressed.discardedForRegression, true);
    assert.equal(regressed.bestScore.overallScore, 8.7);
    assert.deepEqual(restoredSnapshot, { round: 0 });
});

test('captureHtmlKeyframes renders a real HTML frame with Playwright and extracts valid PNG base64 buffers', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'indii-kf-test-'));
    const htmlPath = path.join(tmpDir, 'index.html');
    const outKeyframeDir = path.join(tmpDir, 'keyframes');

    fs.writeFileSync(
        htmlPath,
        `<!doctype html>
<html>
<body style="margin:0;background:#0b0d12;color:#ffe135;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
  <h1 id="title">INDII TEST HOOK</h1>
</body>
</html>`,
        'utf8',
    );

    try {
        const frames = await captureHtmlKeyframes({
            htmlPath,
            width: 320,
            height: 180,
            checkpointsSec: [0.1, 0.25],
            outKeyframeDir,
        });

        assert.equal(frames.length, 2);
        for (const frame of frames) {
            assert.equal(frame.mimeType, 'image/png');
            assert.equal(frame.base64.startsWith('iVBORw0KGgo'), true);
            assert.ok(frame.base64.length > 200);
            assert.ok(frame.savedPath && fs.existsSync(frame.savedPath));
        }
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});
