/**
 * Synthetic Training Data Generator
 *
 * Uses Gemini Pro to generate high-quality training examples for each indiiOS agent.
 * Appends directly to docs/agent-training/datasets/<agent_id>.jsonl
 *
 * Usage:
 *   npx ts-node execution/training/generate_synthetic_data.ts --agent=finance --count=80
 *   npx ts-node execution/training/generate_synthetic_data.ts --agent=all --count=80
 *   npx ts-node execution/training/generate_synthetic_data.ts --agent=director --topic="album cover aesthetics"
 *
 * Strategy: reads existing examples as style reference, generates N more in the same format.
 * Minimum target: 100 examples per agent before Round 2 fine-tuning.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Config ──────────────────────────────────────────────────────────────────

const DATASETS_DIR = path.join(__dirname, '../../docs/agent-training/datasets');
const AGENT_PROMPTS_DIR = path.join(__dirname, '../../docs/agent-training');

const TARGET_EXAMPLES_PER_AGENT = 100;

// ─── Agent Topic Seeds ────────────────────────────────────────────────────────
// Deep topic lists per agent — ensures variety and real-world coverage

const AGENT_TOPICS: Record<string, string[]> = {
    generalist: [
        'routing ambiguous multi-department requests',
        'handling requests that span finance and legal simultaneously',
        'user asks for help with a full album rollout strategy',
        'detecting when a specialist should be called vs answering directly',
        'handling a frustrated user who got a wrong answer from a specialist',
        'coordinating a release campaign across marketing, social, and distribution',
        'user onboarding — explaining what each agent does',
        'escalation when a specialist loop is detected',
    ],
    finance: [
        'calculating recoupment timelines on advances at various stream rates',
        '360 deal revenue splits vs traditional recording deals',
        'tour profitability analysis — guarantees vs door deals',
        'streaming royalty waterfall — label vs artist vs distributor cuts',
        'sync licensing fee structures for indie artists vs majors',
        'merchandise settlement calculations after venue cut',
        'tax implications of foreign touring income',
        'SoundExchange vs PRO payments — what each covers',
        'YouTube Content ID revenue vs direct upload',
        'advance negotiation — what is recoupable vs non-recoupable',
    ],
    legal: [
        'key clauses to watch in a standard recording agreement',
        '360 deal vs recording-only deal — artist perspective',
        'work-for-hire vs co-writer split agreements',
        'sample clearance process and cost estimation',
        'sync license vs master license — what each grants',
        'trademark registration for artist names and logos',
        'social media IP ownership when content goes viral',
        'NFT rights — what an artist actually owns',
        'termination rights under US copyright law (35-year rule)',
        'contract red flags — what clauses should always be negotiated',
    ],
    distribution: [
        'DDEX ERN 4.3 required fields for a single release',
        'ISRC assignment and format validation',
        'UPC vs ISRC — what each identifies',
        'metadata QC failures on major DSPs and how to fix them',
        'content fingerprinting conflicts — two releases claiming same audio',
        'takedown requests and content ID disputes',
        'DSP-specific audio quality requirements — Spotify vs Apple vs Tidal',
        'release scheduling — Friday release windows and delivery lead times',
        'territorial restrictions in distribution agreements',
        'explicit content flagging requirements per DSP',
    ],
    marketing: [
        'Spotify editorial playlist pitch strategy and timing',
        'pre-save campaigns — best practices and conversion benchmarks',
        'playlist pitching to independent curators vs editorial',
        'release marketing timeline — 6 weeks out to release day',
        'DSP-specific ad formats — Spotify marquee vs Apple Search Ads',
        'superfan identification and direct-to-fan monetization',
        'data-driven release strategy using streaming analytics',
        'cross-platform content strategy for an album cycle',
        'TikTok organic strategy for music promotion',
        'press release timing relative to release date',
    ],
    brand: [
        'building a Show Bible for a new artist project',
        'visual identity consistency across streaming profiles',
        'color palette selection for genre-appropriate branding',
        'typography standards for physical and digital media',
        'brand voice documentation — tone, language, no-fly zones',
        'merchandise design alignment with visual identity',
        'artist rebrand strategy — evolving without losing existing fans',
        'press photo direction — mood, setting, wardrobe guidelines',
        'logo usage rules — minimum size, clear space, color variations',
        'brand consistency audit across all artist touchpoints',
    ],
    director: [
        'album cover composition rules — rule of thirds, negative space',
        'color theory for album art — emotional associations by genre',
        'typography on album covers — legibility vs artistic expression',
        'era-specific aesthetic references — 90s hip-hop vs modern R&B',
        'vinyl sleeve design — technical specs and bleed areas',
        'CD booklet layout — page count, fold types, print specs',
        'press photo vs promo photo vs EPK photo — different purposes',
        'mockup generation for merchandise line review',
        'visual treatment for singles vs albums vs EPs',
        'AI image generation prompts for consistent artist imagery',
    ],
    producer: [
        'low-end frequency management in modern trap production',
        'sidechain compression techniques for pump effect',
        'parallel compression on drums — when and how',
        'vocal processing chain for commercial R&B',
        'sample-based production — chopping vs replaying',
        'stem mastering vs traditional mastering for streaming',
        'loudness targets by DSP — LUFS standards',
        'genre-blending production — keeping coherence across sounds',
        'arrangement psychology — building tension and release',
        'working with live musicians in a DAW-first workflow',
    ],
    video: [
        'music video treatment writing — narrative vs performance vs concept',
        'micro-budget music video production — $5K and under',
        'visual storytelling techniques for lyric videos',
        'color grading styles by genre — hyperpop vs soul vs indie',
        'aspect ratio decisions — 16:9 vs 9:16 vs 1:1 by platform',
        'director vs DP relationship in video production',
        'shot list creation for a single-location performance video',
        'VFX integration for independent artists without VFX budget',
        'vertical video strategy for Instagram/TikTok first',
        'video release strategy — teaser vs full premiere',
    ],
    music: [
        'BPM and key analysis for playlist sequencing',
        'sonic branding — creating a consistent sound palette across an album',
        'mood tagging for sync licensing metadata',
        'tempo-based categorization for DJ-friendly releases',
        'audio fingerprinting conflicts — how to resolve',
        'Essentia.js audio features — danceability, energy, valence',
        'comparing two tracks for sonic similarity',
        'genre classification ambiguity — how to handle cross-genre tracks',
        'stem analysis for remix licensing decisions',
        'audio quality forensics — lossy vs lossless detection',
    ],
    social: [
        'Instagram Reels content strategy for music releases',
        'TikTok sound strategy — organic vs paid amplification',
        'Twitter/X community management for artists',
        'YouTube Shorts vs long-form — content strategy decisions',
        'content calendar building for a 6-week release campaign',
        'community engagement — responding to comments at scale',
        'social media crisis management — negative press cycles',
        'fan-generated content — how to leverage UGC legally',
        'platform algorithm changes and adapting strategy',
        'social media metrics that actually matter vs vanity metrics',
    ],
    publicist: [
        'writing a press release for an album announcement',
        'EPK structure — what to include and what to leave out',
        'media outreach strategy — pitching blogs vs magazines vs podcasts',
        'crisis communication — handling a controversy on social media',
        'embargo agreements with press for release coverage',
        'interview preparation — key talking points and no-go topics',
        'review pitching timeline relative to release date',
        'building a press list from scratch',
        'difference between a publicist and a PR firm',
        'measuring PR campaign success — coverage quality vs quantity',
    ],
    licensing: [
        'sync licensing deal structures for indie artists',
        'blanket license vs per-placement license — when each applies',
        'micro-sync platforms — how they work and what to expect',
        'master + sync clearance process for a TV placement',
        'licensing music for video games — royalty-free vs licensed',
        'performing rights vs mechanical rights in sync context',
        'most favored nations clause in sync deals',
        'licensing music internationally — territories and restrictions',
        'creative commons licensing — what it does and does not cover',
        'music library placement — pros and cons vs direct licensing',
    ],
    publishing: [
        'PRO registration — ASCAP vs BMI vs SESAC comparison',
        'publishing deal structures — co-pub vs admin deal vs full publishing',
        'mechanical royalties — how they flow from DSPs to writers',
        'Harry Fox Agency vs direct licensing for mechanicals',
        'catalog valuation for publishing acquisition',
        'sub-publishing deals for international territories',
        'royalty audit rights in publishing agreements',
        'copyright registration process and why it matters',
        'split sheet creation and dispute prevention',
        'black box royalties — what they are and how to claim them',
    ],
    road: [
        'advancing a show — technical rider review process',
        'venue settlement process — box office reconciliation',
        'tour budgeting — fixed vs variable costs per show',
        'hotel block negotiation for a 30-city tour',
        'tour routing optimization — geography vs market priority',
        'production rider vs hospitality rider — what each covers',
        'backline rental vs carrying production — cost-benefit analysis',
        'crew compensation structures — day rate vs weekly rate',
        'tour bus vs van tour — when each makes sense financially',
        'festival booking — offer structures and production requirements',
    ],
    merchandise: [
        'print-on-demand vs bulk printing — break-even analysis',
        'tour merch bundle strategy — maximizing per-head spend',
        'venue merch splits — typical percentages by venue size',
        'merchandise design approval process with brand guidelines',
        'limited edition drops — scarcity strategy and FOMO marketing',
        'fulfillment logistics for online store vs tour',
        'sizing and SKU management for apparel lines',
        'licensing artist likeness for merchandise',
        'quality control for merchandise before a tour',
        'merchandise settlement sheet — line item breakdown',
    ],
    screenwriter: [
        'writing a music video treatment — structure and format',
        'narrative arc for a 3-minute visual story',
        'character development for a documentary-style music video',
        'dialogue writing for an artist short film',
        'visual metaphor development for abstract concepts in lyrics',
        'adapting song lyrics into scene descriptions',
        'writing a 30-second EPK opening statement',
        'series bible for an artist-driven web series',
        'script formatting for commercial vs artistic content',
        'story treatment vs full script — when each is appropriate',
    ],
    security: [
        'social engineering attacks targeting artists and managers',
        'two-factor authentication best practices for artist accounts',
        'credential hygiene for a touring team',
        'account takeover recovery — platform by platform',
        'phishing detection for fake label and brand partnership emails',
        'VPN usage on the road — when necessary vs overkill',
        'data breach response for a small music company',
        'access control for shared team accounts',
        'suspicious login detection and response',
        'secure file sharing for unreleased music',
    ],
    devops: [
        'CI/CD pipeline for a web-based music platform',
        'Firebase deployment strategies — staging vs production',
        'monitoring and alerting for audio generation services',
        'container orchestration for AI sidecar services',
        'CDN configuration for audio file delivery',
        'database backup strategy for Firestore',
        'rate limiting implementation for AI API calls',
        'environment variable management across environments',
        'zero-downtime deployment strategies',
        'cost optimization for GCP services in a music platform',
    ],
    curriculum: [
        'designing a training curriculum for a new music distribution agent',
        'measuring RIG (Relative Information Gain) for agent responses',
        'identifying knowledge gaps through eval set failure analysis',
        'structuring adversarial test sets for agent robustness',
        'curriculum design for agents with overlapping domains',
        'progression from bronze to gold quality training examples',
        'feedback loop design between production usage and training data',
        'benchmark design for music industry AI agents',
        'when to retrain vs when to refine the prompt',
        'quality scoring rubric for agent training examples',
    ],
};

// ─── Core Generator ───────────────────────────────────────────────────────────

async function generateExamples(
    agentId: string,
    count: number,
    topicOverride?: string
): Promise<void> {
    const datasetPath = path.join(DATASETS_DIR, `${agentId}.jsonl`);

    // Read existing examples for style reference
    const existing = await readJsonl(datasetPath);
    const currentCount = existing.length;

    if (currentCount >= TARGET_EXAMPLES_PER_AGENT) {
        console.log(`✓ ${agentId}: already has ${currentCount} examples (target: ${TARGET_EXAMPLES_PER_AGENT}). Skipping.`);
        return;
    }

    const toGenerate = Math.min(count, TARGET_EXAMPLES_PER_AGENT - currentCount);
    console.log(`\n🧠 ${agentId}: generating ${toGenerate} examples (current: ${currentCount})...`);

    const { GoogleGenAI } = await import('@google/genai');
    const apiKey = process.env.VITE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('No API key found. Set VITE_API_KEY or GEMINI_API_KEY env var.');
    }

    const genAI = new GoogleGenAI({ apiKey });

    // Select topics — rotate through agent-specific seeds + any override
    const topics = topicOverride
        ? [topicOverride]
        : (AGENT_TOPICS[agentId] || [`music industry ${agentId} specialist tasks`]);

    const styleReference = existing.slice(0, 3).map(e => JSON.stringify(e)).join('\n');
    const agentTopicList = topics.join('\n- ');

    const prompt = `You are generating high-quality training data for an AI agent called "${agentId}" that works in the music industry platform indiiOS.

STYLE REFERENCE (match this format and quality exactly):
${styleReference}

AGENT DOMAIN TOPICS to draw from:
- ${agentTopicList}

Generate exactly ${toGenerate} training examples. Each must be a valid JSON object on a single line.
Requirements:
- Realistic music industry scenarios with SPECIFIC details (real platform names, real rate ranges, real format specs)
- Expert-level responses that show genuine domain knowledge and judgment
- Mix of difficulty: common cases, edge cases, and expert-level queries
- Include at least 2 adversarial examples (prompt injection or out-of-scope requests) where adversarial=true
- scenario_id format: ${agentId}_[topic_slug]_[3-digit number starting after ${currentCount}]
- quality_tier: "gold" for all
- source: "generated"
- output_sample should be 2-4 paragraphs of substantive expert response

Output ONLY the JSON lines, one per line, no other text.`;

    const result = await genAI.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { temperature: 0.8 }
    });

    const text = result.text || '';
    const lines = text.split('\n').filter(l => l.trim().startsWith('{'));

    let appended = 0;
    const writeStream = fs.createWriteStream(datasetPath, { flags: 'a' });

    for (const line of lines) {
        try {
            JSON.parse(line); // validate
            writeStream.write('\n' + line.trim());
            appended++;
        } catch {
            console.warn(`  ⚠️  Skipping invalid JSON line`);
        }
    }

    writeStream.end();

    const newTotal = currentCount + appended;
    const roundTwoReady = newTotal >= TARGET_EXAMPLES_PER_AGENT;
    console.log(`  ✅ ${agentId}: +${appended} examples → total: ${newTotal} ${roundTwoReady ? '🎓 ROUND 2 READY' : `(need ${TARGET_EXAMPLES_PER_AGENT - newTotal} more)`}`);
}

async function readJsonl(filePath: string): Promise<object[]> {
    if (!fs.existsSync(filePath)) return [];
    const examples: object[] = [];
    const rl = readline.createInterface({
        input: fs.createReadStream(filePath),
        crlfDelay: Infinity
    });
    for await (const line of rl) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try { examples.push(JSON.parse(trimmed)); } catch { /* skip */ }
    }
    return examples;
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const getArg = (key: string) => {
        const flag = args.find(a => a.startsWith(`--${key}=`));
        return flag ? flag.split('=').slice(1).join('=') : undefined;
    };

    const agentArg = getArg('agent') || 'all';
    const countArg = parseInt(getArg('count') || '80', 10);
    const topicArg = getArg('topic');

    const KNOWN_AGENTS = Object.keys(AGENT_TOPICS);

    const agents = agentArg === 'all'
        ? KNOWN_AGENTS
        : agentArg.split(',').map(s => s.trim()).filter(id => KNOWN_AGENTS.includes(id));

    console.log(`\n📚 indiiOS Synthetic Training Data Generator`);
    console.log(`   Target: ${TARGET_EXAMPLES_PER_AGENT} examples/agent | Generating: ${countArg} per agent`);
    console.log(`   Agents: ${agents.join(', ')}\n`);

    for (const agentId of agents) {
        await generateExamples(agentId, countArg, topicArg);
        // Brief pause between agents to avoid rate limiting
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log('\n🎉 Generation complete.');
    console.log('   Run the export script when ready to re-submit fine-tuning jobs:');
    console.log('   npx ts-node execution/training/export_ft_dataset.ts --agent=all --split\n');
}

main().catch(err => {
    console.error('❌ Generation failed:', err);
    process.exit(1);
});
