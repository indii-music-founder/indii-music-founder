#!/usr/bin/env node
/**
 * indii Autonomous Marketing & Ad Factory Runner
 *
 * Compiles a campaign JSON brief into deterministic multi-shape HyperFrames
 * HTML compositions (9:16, 1:1, 4:5, 16:9 x requested durations), writes the
 * Gemini /10 scoring manifest, and emits the coordinated social launch kit.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileAdMatrixProjects, compileProjectToHyperFrames } from '../packages/video-compiler/dist/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const briefArg = process.argv[2] || path.join(__dirname, 'campaigns', 'indii-launch-01.json');
const briefPath = path.resolve(briefArg);

if (!fs.existsSync(briefPath)) {
    console.error(`Campaign brief not found: ${briefPath}`);
    process.exit(1);
}

const brief = JSON.parse(fs.readFileSync(briefPath, 'utf8'));
const outDir = path.join(__dirname, 'out', brief.campaignId);
fs.mkdirSync(outDir, { recursive: true });

const variants = compileAdMatrixProjects(brief);
const manifestVariants = [];

for (const variant of variants) {
    const variantDir = path.join(outDir, variant.variantId);
    fs.mkdirSync(variantDir, { recursive: true });

    const compiled = compileProjectToHyperFrames(variant.project);
    const htmlPath = path.join(variantDir, 'index.html');
    const projectPath = path.join(variantDir, 'project.json');

    fs.writeFileSync(htmlPath, compiled.html, 'utf8');
    fs.writeFileSync(projectPath, JSON.stringify(variant.project, null, 2), 'utf8');

    manifestVariants.push({
        variantId: variant.variantId,
        shape: variant.shape,
        durationSeconds: variant.durationSeconds,
        channelLabel: variant.channelLabel,
        dimensions: { width: variant.project.width, height: variant.project.height },
        safeZone: variant.safeZone,
        htmlPath,
        projectPath,
        scoringCheckpointsSec: [0.5, 1.5, Math.round(variant.durationSeconds * 0.5), Math.max(2, variant.durationSeconds - 1)],
        passThreshold: 9.0,
        status: 'ready_for_render_and_score',
    });
}

const scorecardManifest = {
    campaignId: brief.campaignId,
    title: brief.title,
    brandOrArtistName: brief.brandOrArtistName,
    rubricModel: process.env.INDII_RUBRIC_MODEL || 'gemini-4-neon',
    systemOneModel: 'jev-latest',
    passThreshold: 9.0,
    maxCorrectionAttempts: 2,
    discardOnRegression: true,
    brandKit: brief.brandKit ?? null,
    variants: manifestVariants,
    generatedAtIso: new Date().toISOString(),
};

fs.writeFileSync(
    path.join(outDir, 'scorecard-manifest.json'),
    JSON.stringify(scorecardManifest, null, 2),
    'utf8',
);

const smartLinkUrl = brief.smartLinkUrl ?? 'https://indii.music';

function buildAttributedSmartLink(baseUrl, campaignId, platform, variantId) {
    try {
        const url = new URL(baseUrl);
        url.searchParams.set('utm_source', String(platform).toLowerCase());
        url.searchParams.set('utm_medium', 'social');
        url.searchParams.set('utm_campaign', campaignId);
        url.searchParams.set('utm_content', variantId || String(platform).toLowerCase());
        return url.toString();
    } catch {
        return baseUrl;
    }
}

const rawSocialPosts = [
    {
        platform: 'Instagram',
        format: 'Reel (9:16 · 15s)',
        variantId: `${brief.campaignId}_9x16_15s`,
        copy: `${brief.hookHeadline}\n\n${brief.subHeadline ?? ''}\n\n${brief.ctaText}`.trim(),
        hashtags: ['#indieartist', '#musicmarketing', '#aimusicvideo', '#indiimusic'],
    },
    {
        platform: 'InstagramStory',
        format: 'Story (9:16 · 15s)',
        variantId: `${brief.campaignId}_9x16_15s`,
        copy: `${brief.hookHeadline} — Tap the link sticker to try it free.`,
        hashtags: [],
    },
    {
        platform: 'TikTok',
        format: 'Vertical Hook (9:16 · 15s)',
        variantId: `${brief.campaignId}_9x16_15s`,
        copy: `${brief.hookHeadline} 🎬 ${brief.ctaText}`,
        hashtags: ['#indiemusic', '#musicproducer', '#musicvideo', '#indii'],
    },
    {
        platform: 'YouTubeShorts',
        format: 'Short (9:16 · 30s)',
        variantId: `${brief.campaignId}_9x16_30s`,
        copy: `${brief.title} | ${brief.ctaText}`,
        hashtags: ['#shorts', '#musicvideo', '#independentartist'],
    },
    {
        platform: 'X',
        format: 'Square Feed (1:1 · 15s)',
        variantId: `${brief.campaignId}_1x1_15s`,
        copy: `${brief.hookHeadline} ${brief.ctaText}`.slice(0, 280),
        hashtags: ['#indiemusic', '#AI'],
    },
    {
        platform: 'XHeader',
        format: 'Header Banner (1500x500)',
        copy: `${brief.brandOrArtistName.toUpperCase()} — ${brief.title.toUpperCase()}`,
        hashtags: [],
    },
];

const socialLaunchKit = {
    campaignId: brief.campaignId,
    title: brief.title,
    smartLinkUrl,
    posts: rawSocialPosts.map((post) => ({
        ...post,
        attributedUrl: buildAttributedSmartLink(smartLinkUrl, brief.campaignId, post.platform, post.variantId),
    })),
    generatedAtIso: new Date().toISOString(),
};

fs.writeFileSync(
    path.join(outDir, 'social-launch-kit.json'),
    JSON.stringify(socialLaunchKit, null, 2),
    'utf8',
);

console.log(`Compiled ${manifestVariants.length} HyperFrames ad cuts into ${outDir}`);
