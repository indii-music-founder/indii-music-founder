/**
 * Evolas Phase T1.5 — Measurement harness (docs/EVOLAS_BUILD_PLAN.md).
 *
 * "The single highest-leverage item in T1. Without it nothing downstream is
 * verifiable." Nothing built through T1.4 proves a fader's effect actually
 * shows up in model output — only that the plumbing carrying it is
 * structurally sound. This module closes that gap: Semantic Similarity
 * Rating (SSR) — embed a real response, compare it against human-written
 * anchor texts for each band of each axis, and record which band the
 * response actually measures as, next to which band was requested.
 *
 * PLAN CORRECTION (matches the ISSUE-1314 pattern for T1.4): the build plan
 * put this in `packages/renderer`. Embedding is a Gemini/Vertex call, so
 * per `docs/BACKEND_ONLY_API_DECLARATION.md` it belongs in
 * `packages/firebase`, using the same `getVertexAIClient()` ADC singleton
 * as every other backend AI call. Also uses this repo's own existing
 * embedding model (`text-embedding-004`, 768-dim, from
 * `packages/shared/src/schemas/knowledge.ts`) rather than introducing a
 * second embedding model/dimension into the codebase.
 */

import { getVertexAIClient } from './vertexClient';
import * as admin from 'firebase-admin';
import { KNOWLEDGE_EMBEDDING_MODEL, KNOWLEDGE_EMBEDDING_DIMENSION } from '@indii/shared';
import { PERSONA_FADER_AXES, type PersonaFaderAxis } from '@indii/shared';

const BAND_COUNT = 5;
type Band = 0 | 1 | 2 | 3 | 4;

/** Representative fader value for each band, for reporting a measured position on the same 0-100 scale as a set position. */
const BAND_REPRESENTATIVE_VALUE: readonly [number, number, number, number, number] = [10, 30, 50, 70, 90];

/**
 * Five short, human-written anchor utterances per axis per band — real
 * example phrasing a response at that band would plausibly contain, not
 * instructions (those live in PersonaPromptCompiler.ts's BAND_PHRASES).
 * Anchors are what we compare a REAL RESPONSE against, so they're written
 * in the voice of an answer, not a directive.
 */
const ANCHOR_TEXTS: Record<PersonaFaderAxis, readonly [string[], string[], string[], string[], string[]]> = {
    riskTolerance: [
        [
            'I would not recommend this — the downside is too uncertain for where you are right now.',
            "This is the safer, well-precedented path. I'd stick with it.",
            'Given how much is at stake, this is not the moment to gamble.',
            "Let's not take that risk. There's a more conservative option.",
            'I want to flag this as speculative — proceed only if you can absorb a total loss.',
        ],
        [
            'This leans safe, but there is a modest opportunity here worth noting.',
            "I'd recommend the cautious route, though the upside case isn't nothing.",
            'The conservative choice is still the right one, with a caveat.',
            "There's some risk, but it's manageable if you go in with eyes open.",
            'Play it safe here, though keep an eye on the alternative.',
        ],
        [
            "Here's the tradeoff — I'll lay out both sides and you decide.",
            'It could go either way; the risk and reward are roughly balanced.',
            "I don't have a strong lean here — this is genuinely your call.",
            'Both paths are defensible. Here is what each one costs and buys you.',
            'Weigh it yourself: modest risk, modest but real upside.',
        ],
        [
            'The upside here is real, and the downside is recoverable — I would take it.',
            "This is worth the risk given what's on the table.",
            "I'd lean toward the bolder option here.",
            'The math favors taking this chance.',
            "It's a stretch, but a reasonable one — go for it.",
        ],
        [
            'This is the moment to be bold — the opportunity is significant.',
            "I would push hard for this, even with the risk attached.",
            'Do not undersell this opportunity just because it feels risky.',
            "This is exactly the kind of bet worth making.",
            'Go big here — the potential outweighs the exposure.',
        ],
    ],
    brevity: [
        [
            'Let me walk you through this in detail, starting from the beginning.',
            "There's a lot of context worth covering here, so bear with me.",
            'I want to unpack this fully before we get to the conclusion.',
            'This deserves a thorough explanation, so here it is at length.',
            "I'll go through each factor one by one so nothing gets missed.",
        ],
        [
            "Here's the situation, with enough detail to make an informed call.",
            'A few things are worth spelling out before I give you my take.',
            "Let me give you the fuller picture, organized simply.",
            'This needs a bit of context, so here it is, kept tight.',
            "I'll cover the main points without going too deep.",
        ],
        [
            "Here's the summary, with the key points that matter.",
            'In a few sentences: this is the situation and what it means.',
            "The short version, organized: here's what's going on.",
            'A balanced answer — not too short, not too long.',
            "Here's what you need to know, no more, no less.",
        ],
        [
            'Bottom line: this is the move, and here is why in one line.',
            "Quick take — that's the call, briefly explained.",
            'Short answer: yes, for this reason.',
            "Here's the conclusion, with a one-line justification.",
            'Keeping this tight: the answer is X, because Y.',
        ],
        [
            'Yes.',
            'No — too risky.',
            'Do it.',
            'Wait.',
            'That works.',
        ],
    ],
    directness: [
        [
            "I don't want to overstate this, but there might be something worth reconsidering here, if you feel it's right.",
            "This is just a thought, take it or leave it, but perhaps consider the alternative.",
            'There could be an issue, though I could be reading too much into it.',
            'You might want to look at this again, no pressure either way.',
            "It's possible this isn't ideal, but that's just one perspective.",
        ],
        [
            'I think this could use another look, though it is ultimately your call.',
            "There's a concern here worth mentioning, framed gently.",
            "I'd suggest reconsidering this part, if that's useful.",
            'This seems a little off to me, for what it is worth.',
            'Something here gives me pause, though I want to be careful not to overstate it.',
        ],
        [
            'This part is a problem — worth fixing before you move forward.',
            'I see a clear issue here that needs addressing.',
            'This needs to change; here is why.',
            'I would flag this directly: it does not work as written.',
            'This is not right — here is the fix.',
        ],
        [
            'This clause is bad. Renegotiate it before you sign.',
            "That's a mistake — don't do it that way.",
            'This term hurts you. Push back on it.',
            'Walk away from this specific point.',
            'This is the wrong call. Here is the right one.',
        ],
        [
            'This deal is bad for you. Do not sign it as written.',
            'Stop — this term will cost you real money. Fix it first.',
            'This is a mistake. Full stop.',
            'No. This is not acceptable. Here is what to demand instead.',
            'This will hurt you. I am telling you plainly so you can act on it.',
        ],
    ],
    formality: [
        [
            "Hey, so here's the deal — honestly this one's pretty simple.",
            "Yeah, I'd just go with this, no big deal either way.",
            "Look, it's basically what we talked about before.",
            "Honestly? Just go for it, it'll be fine.",
            "So yeah, that's the gist of it.",
        ],
        [
            "So here's how I'd think about this one.",
            'This is pretty straightforward, honestly.',
            "I'd go with this option, for what it's worth.",
            "Here's the deal, in plain terms.",
            "This one's not too complicated.",
        ],
        [
            'Here is my assessment of the situation.',
            'This is the recommended course of action.',
            'Based on the information available, this is the appropriate choice.',
            'The following considerations apply here.',
            'This is a reasonable approach given the circumstances.',
        ],
        [
            'The following analysis outlines the relevant considerations.',
            'It is advisable to proceed with the option outlined below.',
            'This matter warrants careful review prior to any decision.',
            'The recommended course of action is detailed below.',
            'Please review the following assessment before proceeding.',
        ],
        [
            'Pursuant to the terms outlined herein, the following assessment is provided.',
            'The undersigned recommends proceeding in accordance with the following provisions.',
            'This determination is based on a comprehensive review of the applicable facts.',
            'It is respectfully advised that the party proceed with due consideration of the foregoing.',
            'The foregoing analysis is submitted for consideration prior to execution.',
        ],
    ],
    reasoningTransparency: [
        [
            'The answer is yes.',
            'No.',
            'Proceed with option A.',
            'That is the recommendation.',
            'Yes, go ahead.',
        ],
        [
            'Yes — mainly because of the timing.',
            'No, largely due to the cost involved.',
            'Option A, primarily because it is lower risk.',
            'That is the call, driven mostly by the deadline.',
            'Go ahead, the main factor being the strong terms.',
        ],
        [
            'Yes, weighing the timing and the cost, timing wins out here.',
            'No — the cost outweighs the benefit once you factor in the delay.',
            'Option A, because it is lower risk and the deadline favors it too.',
            'That is the call: the deadline and the terms both point the same way.',
            'Go ahead — the terms are strong and the timing works in your favor.',
        ],
        [
            'Here is my reasoning: the timing matters because of the deadline, the cost matters because of your current runway, and together they point to yes.',
            'Walking through it — the risk is elevated by the short timeline, but offset by the strong terms, so I land on proceeding.',
            'Considering the deadline, the cost, and the precedent from similar deals, option A comes out ahead.',
            'My reasoning: first the timing, then the cost, then how this compares to similar deals — all three point the same direction.',
            'Here is how I got there: I weighed the deadline against the cost, checked it against precedent, and the case holds up.',
        ],
        [
            'Let me walk through every factor: first, the deadline pressure, which matters because your other deals hinge on this one closing; second, the cost, which is manageable against your current runway but would not be next quarter; third, how these terms compare to the last three deals like this one, which were less favorable; and finally, what happens if you wait — the window likely closes. Weighing all of that together, I land on proceeding now.',
            'Here is the full reasoning chain, in order: the market context first, then the specific terms, then your specific financial position, then the alternative of waiting, and only then the conclusion — which is yes, but only because every one of those factors points the same direction.',
            'I want to show my work here rather than just give you an answer: the risk factors are X and Y, the mitigating factors are A and B, the precedent from comparable situations is C, and weighing all of it together — not just the headline number — this is where I land.',
            'Breaking this down fully: what the data shows, what it does not show, what I am inferring versus what I actually know, and how confident I am in each piece before I get to the recommendation.',
            'Here is every factor I weighed, in the order I weighed them, including the ones that argued against my conclusion and why they did not win out.',
        ],
    ],
};

interface CachedAnchorEmbedding {
    axis: PersonaFaderAxis;
    band: Band;
    vectors: number[][];
}

const anchorEmbeddingCache = new Map<string, CachedAnchorEmbedding>();

function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
        throw new Error(`PersonaMeasurement: embedding dimension mismatch (${a.length} vs ${b.length})`);
    }
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i]! * b[i]!;
        normA += a[i]! * a[i]!;
        normB += b[i]! * b[i]!;
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function embedTexts(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const vertex = getVertexAIClient();
    const result = await vertex.models.embedContent({
        model: KNOWLEDGE_EMBEDDING_MODEL,
        contents: texts,
    });
    const vectors = (result.embeddings ?? []).map((e) => e.values ?? []);
    if (vectors.length !== texts.length) {
        throw new Error(
            `PersonaMeasurement: expected ${texts.length} embeddings, got ${vectors.length}`
        );
    }
    for (const v of vectors) {
        if (v.length !== KNOWLEDGE_EMBEDDING_DIMENSION) {
            throw new Error(`PersonaMeasurement: expected ${KNOWLEDGE_EMBEDDING_DIMENSION}-dim embedding, got ${v.length}`);
        }
    }
    return vectors;
}

async function getAnchorEmbeddings(axis: PersonaFaderAxis, band: Band): Promise<number[][]> {
    const cacheKey = `${axis}:${band}`;
    const cached = anchorEmbeddingCache.get(cacheKey);
    if (cached) return cached.vectors;

    const texts = ANCHOR_TEXTS[axis][band];
    const vectors = await embedTexts(texts);
    anchorEmbeddingCache.set(cacheKey, { axis, band, vectors });
    return vectors;
}

export interface AxisMeasurement {
    axis: PersonaFaderAxis;
    setPosition: number;
    measuredPosition: number;
    measuredBand: Band;
    confidence: number;
}

/**
 * Measure where a real response actually lands on one axis, by comparing
 * its embedding against every band's anchor set and picking the closest.
 * `setPosition` is recorded alongside for telemetry — this function does
 * not use it to influence the measurement, only to report the gap.
 */
export async function measureAxis(
    axis: PersonaFaderAxis,
    responseText: string,
    setPosition: number
): Promise<AxisMeasurement> {
    if (!responseText || responseText.trim().length === 0) {
        throw new Error('PersonaMeasurement: responseText must not be empty');
    }

    const [responseVector] = await embedTexts([responseText]);
    if (!responseVector) {
        throw new Error('PersonaMeasurement: failed to embed response text');
    }

    let bestBand: Band = 0;
    let bestScore = -Infinity;
    const bandScores: number[] = [];

    for (let band = 0; band < BAND_COUNT; band++) {
        const anchorVectors = await getAnchorEmbeddings(axis, band as Band);
        const similarities = anchorVectors.map((v) => cosineSimilarity(responseVector, v));
        const avgSimilarity = similarities.reduce((sum, s) => sum + s, 0) / similarities.length;
        bandScores.push(avgSimilarity);
        if (avgSimilarity > bestScore) {
            bestScore = avgSimilarity;
            bestBand = band as Band;
        }
    }

    // Confidence: how much the winning band separates from the runner-up —
    // a near-tie is a low-confidence measurement, worth flagging in telemetry
    // rather than reported with false precision.
    const sorted = [...bandScores].sort((a, b) => b - a);
    const confidence = sorted.length >= 2 ? (sorted[0]! - sorted[1]!) : 1;

    return {
        axis,
        setPosition,
        measuredPosition: BAND_REPRESENTATIVE_VALUE[bestBand],
        measuredBand: bestBand,
        confidence,
    };
}

/**
 * Measure every axis against one response. Callers who set only some axes
 * (e.g. a canary prompt sweeping one axis at a time) should call
 * measureAxis directly instead — this is for a full fader-set response.
 */
export async function measureAllAxes(
    responseText: string,
    setPositions: Record<PersonaFaderAxis, number>
): Promise<AxisMeasurement[]> {
    return Promise.all(
        PERSONA_FADER_AXES.map((axis) => measureAxis(axis, responseText, setPositions[axis]))
    );
}

/**
 * Persist a measurement for telemetry (build plan: "this is what proves a
 * fader does something instead of assuming it"). Write-only, Cloud
 * Functions admin SDK — no client read/write path, no Firestore rule
 * needed for a collection nothing outside a Cloud Function ever touches.
 */
/**
 * `isControlGroup` (T1.7, docs/EVOLAS_BUILD_PLAN.md) tags whether this
 * response was served at the population-default fader position rather than
 * the user's set position. Without this tag, "did personalization help" is
 * unanswerable — every measurement would compare against nothing.
 */
export async function recordMeasurement(
    personaId: string,
    measurement: AxisMeasurement,
    isControlGroup: boolean
): Promise<void> {
    await admin.firestore().collection('personaMeasurements').add({
        personaId,
        axis: measurement.axis,
        setPosition: measurement.setPosition,
        measuredPosition: measurement.measuredPosition,
        measuredBand: measurement.measuredBand,
        confidence: measurement.confidence,
        isControlGroup,
        recordedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}

/** Test/ops utility — clears the in-memory anchor-embedding cache. */
export function resetAnchorEmbeddingCache(): void {
    anchorEmbeddingCache.clear();
}
