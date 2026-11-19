#!/usr/bin/env node
/**
 * Records real TypeSafe (Jev) Boardroom judgments for the prompts the Boardroom
 * e2e specs send — the intent gate plus, for the action path, orchestration
 * complexity and specialist/corpus routing — so the shared fixture answers
 * `typesafeJudge` the way the real judge does instead of blanket defaults.
 *
 *   NODE_USE_ENV_PROXY=1 node scripts/record-boardroom-judgments.mjs
 *
 * Uses the shipped question definitions (bundled from
 * packages/renderer/src/config/typesafeJudgments.ts), so a question change is
 * picked up on the next recording. Auth: TYPESAFE_API_KEY if set; in agent
 * sandboxes the egress proxy injects the credential. The key is never printed
 * or written. Writes e2e/fixtures/boardroomJudgments.json.
 *
 * Evidence class: recorded live judgments with an empty recentConversation and
 * activeModule 'dashboard' (the module e2e lands on) — an approximation of
 * in-app judging (which sees prior turns), not a replay.
 */
import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'e2e/fixtures/boardroomJudgments.json');
const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const MODEL = 'jev-latest';

/** Every prompt a Boardroom e2e spec submits. Keep in sync when adding specs. */
const PROMPTS = [
    // workflow-strategic-goal.spec.ts
    "Let's plan a Detroit tour with the new album art",
    'Creative Director generate the art, Road Director plan Detroit advance',
    'Imagery and dates are locked. Trigger rollout.',
    'Generate rollout materials and schedule drafts',
    'We are done. Clear the boardroom table.',
    // boardroom-real-user-scenario.spec.ts
    "Let's bring in Marketing and Finance",
    'How much should we spend on this campaign?',
    "Let's bring in Legal to check the agreements",
    'Marketing and Finance, you are good to go, thank you',
    'Legal, what templates are we using and what is the visual split sheet agreement?',
    "Creative and Video, let's generate a marketing visual for this campaign.",
    "Social and Publicist, let's outline the social copy and write a press release hook.",
    "Brand and Music, let's align on the artistic vibe",
    'Thank you team, we are done for today. Clear the table.',
];

async function loadQuestions() {
    const dir = mkdtempSync(join(tmpdir(), 'boardroom-judgments-'));
    const outfile = join(dir, 'questions.mjs');
    await build({
        stdin: {
            contents: `export {
                BOARDROOM_INTENT_QUESTION, BOARDROOM_INTENT_MIN_CONFIDENCE,
                ORCHESTRATION_COMPLEXITY_QUESTION, SPECIALIST_ROUTE_QUESTION, RAG_CORPUS_ROUTE_QUESTION,
            } from './packages/renderer/src/config/typesafeJudgments.ts';`,
            resolveDir: root,
            loader: 'ts',
        },
        bundle: true,
        platform: 'node',
        format: 'esm',
        outfile,
        alias: { '@': join(root, 'packages/renderer/src'), '@indii/shared': join(root, 'packages/shared/src/index.ts') },
        define: { 'import.meta.env': '{}' },
        logLevel: 'error',
    });
    return import(pathToFileURL(outfile).href);
}

async function judge(state, questions) {
    const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.TYPESAFE_API_KEY || 'proxy-injected'}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL, state, questions }),
        signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`TypeSafe HTTP ${res.status}`);
    return res.json();
}

const {
    BOARDROOM_INTENT_QUESTION, BOARDROOM_INTENT_MIN_CONFIDENCE,
    ORCHESTRATION_COMPLEXITY_QUESTION, SPECIALIST_ROUTE_QUESTION, RAG_CORPUS_ROUTE_QUESTION,
} = await loadQuestions();

const pick = (answer, label, prompt) => {
    const { choice, confidence } = answer ?? {};
    if (typeof choice !== 'string' || typeof confidence !== 'number') throw new Error(`Unexpected ${label} judgment for: ${prompt}`);
    return { choice, confidence };
};

// Same state shapes the app sends (judgeBoardroomIntent, judgeOrchestrationComplexity,
// judgeSpecialistAgentRoute in typesafeJudgments.ts).
const judgments = {};
let inputTokens = 0;
let outputTokens = 0;
const tally = (result) => {
    inputTokens += result.usage?.input_tokens ?? 0;
    outputTokens += result.usage?.output_tokens ?? 0;
};
for (const prompt of PROMPTS) {
    const intentResult = await judge({ query: prompt, recentConversation: '', attachedImageCount: 0 }, { intent: BOARDROOM_INTENT_QUESTION });
    const complexityResult = await judge({ query: prompt }, { complexity: ORCHESTRATION_COMPLEXITY_QUESTION });
    const routeResult = await judge(
        { query: prompt, activeModule: 'dashboard', hasSourceAssets: false },
        { specialist: SPECIALIST_ROUTE_QUESTION, corpus: RAG_CORPUS_ROUTE_QUESTION },
    );
    [intentResult, complexityResult, routeResult].forEach(tally);
    const entry = {
        intent: pick(intentResult.answers?.intent, 'intent', prompt),
        complexity: pick(complexityResult.answers?.complexity, 'complexity', prompt),
        specialist: pick(routeResult.answers?.specialist, 'specialist', prompt),
        corpus: pick(routeResult.answers?.corpus, 'corpus', prompt),
    };
    judgments[prompt] = entry;
    const fmt = ({ choice, confidence }) => `${choice}@${confidence.toFixed(2)}`;
    console.log(`${fmt(entry.intent).padEnd(16)} ${fmt(entry.complexity).padEnd(15)} ${fmt(entry.specialist).padEnd(18)} ${prompt}`);
}
writeFileSync(OUT, `${JSON.stringify({
    $comment: 'Generated by scripts/record-boardroom-judgments.mjs from live TypeSafe (jev-latest) with the shipped judgment questions. Do not edit by hand.',
    model: MODEL,
    minConfidence: BOARDROOM_INTENT_MIN_CONFIDENCE,
    judgments,
}, null, 2)}\n`);
console.log(`wrote ${OUT} (${PROMPTS.length} prompts, ${inputTokens} input / ${outputTokens} output tokens)`);
