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

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Config ──────────────────────────────────────────────────────────────────

const DATASETS_DIR = path.join(__dirname, '../../docs/agent-training/datasets');
const AGENT_PROMPTS_DIR = path.join(__dirname, '../../docs/agent-training');

const TARGET_EXAMPLES_PER_AGENT = 400;

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
        'termination rights under US copyright law (35-year rule)',
        'contract red flags — what clauses should always be negotiated',
        'disputing false AI-flagging by DSPs to prove human creation',
        'protecting human artists against unauthorized AI voice cloning',
        'opting human catalogs out of AI training datasets',
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
        'proving human authorship to DSPs following false AI-flags',
        'catalog migration between distributors — avoiding gaps in availability',
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
        'TikTok organic strategy and Creator Marketplace registration',
        'YouTube Shorts monetization strategy — 45% RPM share',
        'micro-budget ad deployment — $10/day strategies with measurable ROI',
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
        'call sheet generation for a single-day music video shoot',
        'script breakdown — identifying props, wardrobe, locations, extras',
        'crew coordination — gaffer, grip, AC, hair/makeup day rates',
        'location scouting — permit requirements by city and state',
        'production budget estimation for a $15K music video',
        'SAG-AFTRA compliance for background performers in music videos',
        'equipment procurement — camera packages, lighting rental houses',
        'production insurance requirements — certificates of insurance for locations',
        'weather contingency planning and cover sets',
        'production timeline — pre-pro through wrap and delivery',
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
        'mix and master review for business-ready releases (technical check)',
    ],
    social: [
        'Instagram Reels content strategy for music releases',
        'TikTok sound strategy — organic vs paid amplification',
        'X (Twitter) community management for artists',
        'YouTube Shorts monetization — 45% RPM share and vertical-first content',
        'content calendar building for a 6-week release campaign',
        'community engagement — responding to comments at scale',
        'social media crisis management — coordinated harassment response',
        'fan-generated content — how to leverage UGC legally',
        'platform algorithm changes and adapting strategy',
        'social media metrics that actually matter vs vanity metrics',
        'Discord and Telegram community webhook management',
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
        'music distribution 101 — how DSPs work, release timelines, and delivery formats',
        'copyright fundamentals — composition vs master recording ownership',
        'royalty types explained — mechanical, performance, sync, and print',
        'PRO registration walkthrough — ASCAP vs BMI vs SESAC for a first-time artist',
        'label deal structures — indie vs signed, 360 deals, and what to negotiate',
        'first release strategy — single vs EP vs album for a debut',
        'touring 101 — booking your first show, building a routing strategy',
        'sync licensing basics — what artists need to know to get placements',
        'building a team — when to get a manager, lawyer, and accountant',
        'understanding streaming economics — per-stream rates, save rates, and discovery algorithms',
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

    const toGenerateTotal = Math.min(count, TARGET_EXAMPLES_PER_AGENT - currentCount);
    if (toGenerateTotal <= 0) return;

    console.log(`\n🧠 ${agentId}: generating ${toGenerateTotal} examples in batches (current: ${currentCount})...`);

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

    const BATCH_SIZE = 20;
    let totalAppended = 0;

    for (let i = 0; i < toGenerateTotal; i += BATCH_SIZE) {
        const batchCount = Math.min(BATCH_SIZE, toGenerateTotal - totalAppended);
        console.log(`  → Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(toGenerateTotal / BATCH_SIZE)} (${batchCount} examples)...`);

        const styleReference = existing.slice(0, 3).map(e => JSON.stringify(e)).join('\n');
        const agentTopicList = topics.join('\n- ');

        const prompt = `You are generating high-quality training data for an AI agent called "${agentId}" that works in the music industry platform indiiOS.

CONTEXT: indiiOS is a MUSIC BUSINESS app for HUMAN-MADE music ONLY. 
ARCHITECTURE: Boardroom Swarm protocol (Swarm-native specialists).
REASONING: Agents operate in three modes:
- Mode A (Curriculum): Pedagogical, teaching the artist.
- Mode B (Executor): Tool-driven action.
- Mode C (Companion): Human-centric dialogue.

POLICY:
1. Business starts AFTER the song is created and mastered. No production tools.
2. We serve human creators ONLY. No support for AI-generated songs.
3. AI topics are strictly defensive (e.g. disputing false AI flags, protecting against voice cloning).
4. SWARM PROTOCOL: Agents must be aware of other seated specialists (delimited by <<<SYSTEM_ORCHESTRATION>>>).

STYLE REFERENCE (match this format and quality exactly):
${styleReference}

AGENT DOMAIN TOPICS to draw from:
- ${agentTopicList}

Generate exactly ${batchCount} training examples. Each must be a valid JSON object on a single line.
Requirements:
- Realistic music industry scenarios with SPECIFIC details (real platform names, real rate ranges, real format specs)
- Expert-level responses that show genuine domain knowledge and SWARM-native collaboration logic
- scenario_id format: ${agentId}_[topic_slug]_[3-digit number starting after ${currentCount + totalAppended}]
- quality_tier: "gold"
- source: "generated_r8_swarm"
- output_sample should be 2-4 paragraphs of substantive expert response incorporating Mode-based reasoning (Mode A/B/C)

Output ONLY the JSON lines, one per line, no other text.`;

        const result = await genAI.models.generateContent({
            model: 'gemini-3.1-pro-preview',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { temperature: 0.8 }
        });

        const text = result.text || '';
        const lines = text.split('\n').filter(l => l.trim().startsWith('{'));

        const writeStream = fs.createWriteStream(datasetPath, { flags: 'a' });
        let batchAppended = 0;

        for (const line of lines) {
            try {
                JSON.parse(line); // validate
                writeStream.write('\n' + line.trim());
                batchAppended++;
            } catch {
                // skip invalid
            }
        }
        writeStream.end();
        totalAppended += batchAppended;

        // Small delay to avoid rate limits
        if (i + BATCH_SIZE < toGenerateTotal) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    const newTotal = currentCount + totalAppended;
    const roundTwoReady = newTotal >= TARGET_EXAMPLES_PER_AGENT;
    console.log(`  ✅ ${agentId}: +${totalAppended} examples → total: ${newTotal} ${roundTwoReady ? '🎓 R8 READY' : `(need ${TARGET_EXAMPLES_PER_AGENT - newTotal} more)`}`);
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
