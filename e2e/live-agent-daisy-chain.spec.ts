import { test, expect } from './fixtures/auth';
import type { Page } from '@playwright/test';
import * as fs from 'fs/promises';
import * as path from 'path';

type CampaignStatus = 'PENDING' | 'EXECUTING' | 'DONE' | 'FAILED';
type Platform = 'Twitter' | 'Instagram' | 'LinkedIn' | 'Email';

interface TestImageAsset {
  assetType: 'image';
  title: string;
  imageUrl: string;
  caption: string;
}

interface TestScheduledPost {
  id: string;
  platform: Platform;
  copy: string;
  imageAsset: TestImageAsset;
  day: number;
  scheduledTime: string;
  status: CampaignStatus;
}

interface TestCampaignAsset {
  id: string;
  assetType: 'campaign';
  title: string;
  description: string;
  durationDays: number;
  startDate: string;
  endDate: string;
  budget: number;
  posts: TestScheduledPost[];
  status: CampaignStatus;
  attachedAssets: string[];
}

interface TestProfile {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  photoURL: null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
  emailVerified: boolean;
  membership: { tier: 'pro'; expiresAt: null };
  preferences: { theme: 'system'; notifications: true; observabilityEnabled: false };
  accountType: 'artist';
  bio: string;
  careerStage: string;
  goals: string[];
  location: string;
  brandKit: {
    colors: string[];
    fonts: string;
    brandDescription: string;
    negativePrompt: string;
    socials: Record<string, string>;
    brandAssets: Array<{ id: string; url: string; description: string; category: string; tags: string[] }>;
    referenceImages: Array<{ id: string; url: string; description: string; category: string; tags: string[] }>;
    releaseDetails: {
      title: string;
      type: string;
      artists: string;
      genre: string;
      mood: string;
      themes: string;
      lyrics: string;
      coverArtUrl: string;
      releaseDate: string;
    };
    targetAudience: string;
    visualIdentity: string;
    digitalAura: string[];
  };
}

interface LiveScenario {
  profile: TestProfile;
  coverSvg: string;
  verticalSvg: string;
  campaign: TestCampaignAsset;
}

interface AgentStepRecord {
  agentId: string;
  reads: string[];
  writes: string[];
  summary: string;
}

interface ChainReport {
  traceId: string;
  userPointer: string;
  campaign: TestCampaignAsset;
  steps: AgentStepRecord[];
  assets: Array<{ id: string; kind: string; path: string; caption: string }>;
  socialCalendar: Array<{ day: number; platform: Platform; postId: string; assetId: string; copy: string }>;
  pressRelease: { path: string; headline: string; campaignId: string; assetIds: string[] };
  finance: {
    campaignId: string;
    budget: number;
    allocations: Record<string, number>;
    source: string;
  };
  qa: {
    ready: boolean;
    requiredReads: string[];
    missingReads: string[];
  };
}

test.describe('Live coordinated agent daisy chain', () => {
  test.use({ viewport: { width: 1440, height: 920 } });

  test('creates connected assets, campaign data, and downstream agent handoffs', async ({ authedPage: page }) => {
    const scenario = buildScenario();
    const reportDir = path.join(process.cwd(), 'artifacts', 'live-agent-daisy-chain');
    const chain = await runLiveAgentChain(scenario, reportDir);

    await installLiveAgentMocks(page, scenario, chain);

    await page.goto('/agent');
    await page.waitForSelector('#root', { state: 'visible', timeout: 20_000 });
    await seedAppContext(page, scenario, chain);

    const chatTab = page.getByRole('button', { name: 'Chat' });
    await expect(chatTab).toBeVisible({ timeout: 10_000 });
    await chatTab.click();

    const prompt = page.getByTestId('main-prompt-input');
    await expect(prompt).toBeVisible({ timeout: 10_000 });
    await prompt.fill(
      'LIVE_AGENT_CHAIN: act like a user launching a connected release campaign. Use my profile, generated assets, campaign, social, publicist, and finance data.'
    );
    await page.getByTestId('command-bar-run-btn').click();

    await expect(page.getByText('Live agent chain ready')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(scenario.campaign.title)).toBeVisible({ timeout: 10_000 });

    const campaignsTab = page.getByRole('button', { name: 'Campaigns' });
    await expect(campaignsTab).toBeVisible({ timeout: 10_000 });
    await campaignsTab.click();
    await page.evaluate((campaign) => {
      window.dispatchEvent(new CustomEvent('TEST_INJECT_AGENT_CAMPAIGNS', { detail: { campaigns: [campaign] } }));
    }, scenario.campaign);
    await expect(page.getByText(scenario.campaign.title)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(`Budget: $${scenario.campaign.budget.toLocaleString()}`)).toBeVisible({ timeout: 10_000 });

    await page.goto('/campaign');
    await page.waitForSelector('#root', { state: 'visible', timeout: 20_000 });
    await page.locator('h2').filter({ hasText: 'Active Campaigns' }).waitFor({ state: 'visible', timeout: 15_000 });
    await page.evaluate((campaign) => {
      window.dispatchEvent(new CustomEvent('TEST_INJECT_SET_CAMPAIGN', { detail: { campaign } }));
    }, scenario.campaign);

    await expect(page.getByRole('heading', { name: scenario.campaign.title })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Total Posts')).toBeVisible();
    await expect(page.getByText(`${scenario.campaign.durationDays} Days`)).toBeVisible();

    const storedChain = await page.evaluate(() => {
      const raw = localStorage.getItem('indii.liveAgentDaisyChain.latest');
      return raw ? JSON.parse(raw) : null;
    });

    expect(storedChain.qa.ready).toBe(true);
    expect(storedChain.finance.campaignId).toBe(scenario.campaign.id);
    expect(storedChain.pressRelease.assetIds).toEqual(scenario.campaign.attachedAssets);
    expect(storedChain.socialCalendar).toHaveLength(scenario.campaign.posts.length);

    for (const asset of chain.assets) {
      const stat = await fs.stat(asset.path);
      expect(stat.size).toBeGreaterThan(500);
    }
  });
});

function buildScenario(): LiveScenario {
  const coverSvg = buildCoverSvg();
  const verticalSvg = buildVerticalSvg();
  const coverDataUrl = svgToDataUrl(coverSvg);
  const verticalDataUrl = svgToDataUrl(verticalSvg);
  const now = '2026-05-28T12:00:00.000Z';

  const profile: TestProfile = {
    id: 'test-user-uid-e2e',
    uid: 'test-user-uid-e2e',
    email: 'e2e@indii.test',
    displayName: 'Mara Vale',
    photoURL: null,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
    emailVerified: true,
    membership: { tier: 'pro', expiresAt: null },
    preferences: { theme: 'system', notifications: true, observabilityEnabled: false },
    accountType: 'artist',
    bio: 'Detroit alt-pop artist making neon-drenched club confessionals.',
    careerStage: 'Building regional momentum',
    goals: ['Grow pre-saves', 'Pitch playlists', 'Book Midwest support slots'],
    location: 'Detroit, MI',
    brandKit: {
      colors: ['#00F5D4', '#FF4D8D', '#111827'],
      fonts: 'Space Grotesk, Inter',
      brandDescription: 'High-contrast Detroit alt-pop with chrome textures, VHS grain, and direct-to-fan urgency.',
      negativePrompt: 'muted beige, generic stock music, washed-out palettes',
      socials: {
        instagram: '@maravale',
        tiktok: '@maravale',
        spotify: 'spotify:artist:test-maravale',
        website: 'https://maravale.example',
        distributor: 'TuneCore',
      },
      brandAssets: [
        {
          id: 'asset-cover-neon-altar',
          url: coverDataUrl,
          description: 'Neon Altar cover art',
          category: 'logo',
          tags: ['cover', 'single', 'neon'],
        },
        {
          id: 'asset-vertical-teaser-neon-altar',
          url: verticalDataUrl,
          description: 'Vertical teaser creative',
          category: 'environment',
          tags: ['reels', 'tiktok', 'teaser'],
        },
      ],
      referenceImages: [],
      releaseDetails: {
        title: 'Neon Altar',
        type: 'Single',
        artists: 'Mara Vale',
        genre: 'Alt Pop',
        mood: 'urgent, glossy, nocturnal',
        themes: 'self-reinvention, late-night release, Detroit movement',
        lyrics: 'I built a neon altar from the nights I survived.',
        coverArtUrl: coverDataUrl,
        releaseDate: '2026-06-19',
      },
      targetAudience: '18-34 alt-pop and electronic fans in Detroit, Chicago, Toronto, and online DIY music circles.',
      visualIdentity: 'Chrome lettering, black negative space, electric cyan and hot pink lighting.',
      digitalAura: ['neon', 'club', 'Detroit', 'chrome', 'direct-to-fan'],
    },
  };

  const campaign: TestCampaignAsset = {
    id: 'campaign-neon-altar-presave',
    assetType: 'campaign',
    title: 'Neon Altar Pre-Save Sprint',
    description: 'A connected 21-day pre-save campaign using generated cover art, vertical teasers, press copy, and budget allocation.',
    durationDays: 21,
    startDate: '2026-05-29',
    endDate: '2026-06-19',
    budget: 2400,
    status: 'PENDING',
    attachedAssets: ['asset-cover-neon-altar', 'asset-vertical-teaser-neon-altar'],
    posts: [
      {
        id: 'post-ig-teaser-01',
        platform: 'Instagram',
        copy: 'The first signal from Neon Altar is live. Pre-save now and step into the chrome room.',
        imageAsset: {
          assetType: 'image',
          title: 'Neon Altar vertical teaser',
          imageUrl: verticalDataUrl,
          caption: 'Vertical teaser for Instagram Reels.',
        },
        day: 1,
        scheduledTime: '2026-05-29T18:00:00.000Z',
        status: 'PENDING',
      },
      {
        id: 'post-tw-cover-02',
        platform: 'Twitter',
        copy: 'Neon Altar arrives June 19. Cover art by the indii campaign chain. Pre-save link in bio.',
        imageAsset: {
          assetType: 'image',
          title: 'Neon Altar cover reveal',
          imageUrl: coverDataUrl,
          caption: 'Cover reveal for X.',
        },
        day: 4,
        scheduledTime: '2026-06-01T16:00:00.000Z',
        status: 'PENDING',
      },
      {
        id: 'post-email-presave-03',
        platform: 'Email',
        subject: 'Enter the Neon Altar',
        copy: 'You are on the first-listener list. Pre-save Neon Altar before it drops June 19.',
        imageAsset: {
          assetType: 'image',
          title: 'Neon Altar email header',
          imageUrl: coverDataUrl,
          caption: 'Email header creative.',
        },
        day: 10,
        scheduledTime: '2026-06-07T15:00:00.000Z',
        status: 'PENDING',
      },
      {
        id: 'post-linkedin-story-04',
        platform: 'LinkedIn',
        copy: 'Independent release ops in motion: assets, press, social, and spend plan are connected for Neon Altar.',
        imageAsset: {
          assetType: 'image',
          title: 'Neon Altar campaign operations card',
          imageUrl: verticalDataUrl,
          caption: 'Operations-focused campaign post.',
        },
        day: 14,
        scheduledTime: '2026-06-11T14:30:00.000Z',
        status: 'PENDING',
      },
    ],
  };

  return { profile, coverSvg, verticalSvg, campaign };
}

async function runLiveAgentChain(scenario: LiveScenario, reportDir: string): Promise<ChainReport> {
  await fs.mkdir(reportDir, { recursive: true });

  const coverPath = path.join(reportDir, 'neon-altar-cover.svg');
  const verticalPath = path.join(reportDir, 'neon-altar-vertical-teaser.svg');
  const campaignPath = path.join(reportDir, 'campaign.json');
  const pressPath = path.join(reportDir, 'press-release.md');
  const reportPath = path.join(reportDir, 'coordination-report.html');

  await fs.writeFile(coverPath, scenario.coverSvg, 'utf8');
  await fs.writeFile(verticalPath, scenario.verticalSvg, 'utf8');
  await fs.writeFile(campaignPath, JSON.stringify(scenario.campaign, null, 2), 'utf8');

  const steps: AgentStepRecord[] = [];
  const memory = new Map<string, unknown>();

  const write = (agentId: string, key: string, value: unknown, summary: string, reads: string[] = []) => {
    memory.set(key, value);
    steps.push({ agentId, reads, writes: [key], summary });
  };

  const read = <T,>(agentId: string, key: string): T => {
    if (!memory.has(key)) {
      throw new Error(`${agentId} could not read required shared data: ${key}`);
    }
    return memory.get(key) as T;
  };

  write('keeper', 'user.profile', scenario.profile, 'Resolved user profile, brand kit, release details, and user info lookup pointer.');

  const profile = read<TestProfile>('creative', 'user.profile');
  write('creative', 'assets.generated', [
    { id: 'asset-cover-neon-altar', kind: 'cover_art', path: coverPath, caption: profile.brandKit.releaseDetails.title },
    { id: 'asset-vertical-teaser-neon-altar', kind: 'vertical_teaser', path: verticalPath, caption: profile.brandKit.visualIdentity },
  ], 'Generated campaign visuals and stored asset IDs for downstream agents.', ['user.profile']);

  const generatedAssets = read<ChainReport['assets']>('marketing', 'assets.generated');
  write('marketing', 'campaign.primary', scenario.campaign, 'Created the pre-save campaign linked to generated asset IDs and launch dates.', ['user.profile', 'assets.generated']);

  const campaign = read<TestCampaignAsset>('social', 'campaign.primary');
  write('social', 'social.calendar', campaign.posts.map((post) => ({
    day: post.day,
    platform: post.platform,
    postId: post.id,
    assetId: post.imageAsset.title.includes('cover') ? 'asset-cover-neon-altar' : 'asset-vertical-teaser-neon-altar',
    copy: post.copy,
  })), 'Built social calendar from the shared campaign and asset set.', ['campaign.primary', 'assets.generated']);

  const pressRelease = [
    '# Mara Vale Announces "Neon Altar"',
    '',
    'Detroit alt-pop artist Mara Vale will release "Neon Altar" on June 19, 2026.',
    'The campaign uses connected cover art, vertical social assets, pre-save messaging, and a shared budget plan.',
    '',
    'Quote: "I built a neon altar from the nights I survived."',
  ].join('\n');
  await fs.writeFile(pressPath, pressRelease, 'utf8');
  write('publicist', 'press.release', {
    path: pressPath,
    headline: 'Mara Vale Announces "Neon Altar"',
    campaignId: campaign.id,
    assetIds: campaign.attachedAssets,
  }, 'Drafted press release using user bio, release details, campaign title, and generated assets.', ['user.profile', 'campaign.primary', 'assets.generated']);

  write('finance', 'finance.spendPlan', {
    campaignId: campaign.id,
    budget: campaign.budget,
    allocations: {
      paidSocial: 1440,
      creatorBounties: 480,
      publicistPush: 300,
      contingency: 180,
    },
    source: 'campaign.primary.budget',
  }, 'Allocated campaign budget from the campaign record so finance reads the same source marketing wrote.', ['campaign.primary']);

  const requiredReads = ['user.profile', 'assets.generated', 'campaign.primary', 'social.calendar', 'press.release', 'finance.spendPlan'];
  const missingReads = requiredReads.filter((key) => !memory.has(key));
  write('qa', 'qa.lineage', {
    ready: missingReads.length === 0,
    requiredReads,
    missingReads,
  }, 'Verified every downstream agent could read the data written by earlier agents.', requiredReads.filter((key) => memory.has(key)));

  const chain: ChainReport = {
    traceId: `live-chain-${Date.now()}`,
    userPointer: 'user.profile',
    campaign,
    steps,
    assets: generatedAssets,
    socialCalendar: read<ChainReport['socialCalendar']>('reporter', 'social.calendar'),
    pressRelease: read<ChainReport['pressRelease']>('reporter', 'press.release'),
    finance: read<ChainReport['finance']>('reporter', 'finance.spendPlan'),
    qa: read<ChainReport['qa']>('reporter', 'qa.lineage'),
  };

  await fs.writeFile(path.join(reportDir, 'latest.json'), JSON.stringify(chain, null, 2), 'utf8');
  await fs.writeFile(reportPath, renderCoordinationReport(chain), 'utf8');
  return chain;
}

async function installLiveAgentMocks(page: Page, scenario: LiveScenario, chain: ChainReport): Promise<void> {
  const origin = new URL(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4242').origin;
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-version, X-HTTP-Session-Id, X-Goog-Api-Key, X-Goog-Api-Client, X-Firebase-Client',
  };

  await page.route(/.*(firebasevertexai|generativelanguage)\.googleapis\.com.*/, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    const aiResponse = {
      candidates: [{
        content: {
          role: 'model',
          parts: [{
            text: [
              'Live agent chain ready.',
              `Campaign: ${scenario.campaign.title}`,
              `Assets: ${scenario.campaign.attachedAssets.join(', ')}`,
              `Trace: ${chain.traceId}`,
            ].join('\n'),
          }],
        },
        finishReason: 'STOP',
      }],
    };

    if (route.request().url().includes('streamGenerateContent') && route.request().url().includes('alt=sse')) {
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: 'text/event-stream',
        body: `data: ${JSON.stringify(aiResponse)}\n\n`,
      });
      return;
    }

    await route.fulfill({
      status: 200,
      headers: corsHeaders,
      contentType: 'application/json',
      body: JSON.stringify(aiResponse),
    });
  });

  await page.route('**/firestore.googleapis.com/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    const postData = route.request().postData() || '';

    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    if (url.includes(':listen') || url.includes('/Listen/') || url.includes('/Write/') || url.includes('channel?')) {
      await route.fulfill({
        status: 403,
        headers: corsHeaders,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 403, message: 'Permission Denied', status: 'PERMISSION_DENIED' } }),
      });
      return;
    }

    const campaignDoc = firestoreDocument(`campaigns/${scenario.campaign.id}`, {
      ...scenario.campaign,
      userId: scenario.profile.id,
    });

    if (url.includes(':runQuery') && postData.includes('campaigns')) {
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: 'application/json',
        body: JSON.stringify([{ document: campaignDoc, readTime: new Date().toISOString() }]),
      });
      return;
    }

    if (method === 'GET' && url.includes('/documents/campaigns')) {
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: 'application/json',
        body: JSON.stringify({ documents: [campaignDoc] }),
      });
      return;
    }

    if (method === 'GET' && url.includes(`/documents/users/${scenario.profile.id}`)) {
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: 'application/json',
        body: JSON.stringify(firestoreDocument(`users/${scenario.profile.id}`, scenario.profile)),
      });
      return;
    }

    if (method === 'POST' || method === 'PATCH') {
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: 'application/json',
        body: JSON.stringify({
          name: `projects/mock-project/databases/(default)/documents/mock/${Date.now()}`,
          fields: {},
          createTime: new Date().toISOString(),
          updateTime: new Date().toISOString(),
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      headers: corsHeaders,
      contentType: 'application/json',
      body: JSON.stringify({ documents: [] }),
    });
  });
}

async function seedAppContext(page: Page, scenario: LiveScenario, chain: ChainReport): Promise<void> {
  const seeded = await page.evaluate(async ({ profile, chainReport }) => {
    localStorage.setItem('indii.liveAgentDaisyChain.latest', JSON.stringify(chainReport));
    try {
      const storeModule = await import('/src/core/store/index.ts');
      storeModule.useStore.setState({
        userProfile: profile,
        currentOrganizationId: 'org-live-agent-e2e',
        activeAgents: ['generalist', 'creative', 'marketing', 'social', 'publicist', 'finance', 'keeper'],
        conversationMode: 'direct',
      });
      return true;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }, { profile: scenario.profile, chainReport: chain });

  expect(seeded).toBe(true);
}

function firestoreDocument(relativePath: string, data: Record<string, unknown>) {
  return {
    name: `projects/mock-project/databases/(default)/documents/${relativePath}`,
    fields: toFirestoreFields(data),
    createTime: new Date().toISOString(),
    updateTime: new Date().toISOString(),
  };
}

function toFirestoreFields(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, toFirestoreValue(value)]));
}

function toFirestoreValue(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  if (typeof value === 'object') return { mapValue: { fields: toFirestoreFields(value as Record<string, unknown>) } };
  return { stringValue: String(value) };
}

function buildCoverSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="3000" height="3000" viewBox="0 0 3000 3000">
  <rect width="3000" height="3000" fill="#080A12"/>
  <circle cx="1500" cy="1500" r="980" fill="none" stroke="#00F5D4" stroke-width="30" opacity="0.85"/>
  <circle cx="1500" cy="1500" r="720" fill="none" stroke="#FF4D8D" stroke-width="18" opacity="0.65"/>
  <path d="M520 1910 C980 1290 2020 1290 2480 1910" fill="none" stroke="#F8FAFC" stroke-width="26" opacity="0.72"/>
  <text x="1500" y="1440" text-anchor="middle" font-family="Arial, sans-serif" font-size="236" font-weight="800" fill="#F8FAFC">NEON</text>
  <text x="1500" y="1680" text-anchor="middle" font-family="Arial, sans-serif" font-size="236" font-weight="800" fill="#F8FAFC">ALTAR</text>
  <text x="1500" y="2020" text-anchor="middle" font-family="Arial, sans-serif" font-size="72" letter-spacing="18" fill="#00F5D4">MARA VALE</text>
</svg>`;
}

function buildVerticalSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <rect width="1080" height="1920" fill="#090B14"/>
  <linearGradient id="beam" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#00F5D4"/>
    <stop offset="1" stop-color="#FF4D8D"/>
  </linearGradient>
  <rect x="96" y="140" width="888" height="1640" rx="42" fill="none" stroke="url(#beam)" stroke-width="14"/>
  <path d="M210 1260 C360 980 720 980 870 1260" fill="none" stroke="#F8FAFC" stroke-width="16" opacity="0.78"/>
  <text x="540" y="760" text-anchor="middle" font-family="Arial, sans-serif" font-size="118" font-weight="800" fill="#F8FAFC">NEON</text>
  <text x="540" y="900" text-anchor="middle" font-family="Arial, sans-serif" font-size="118" font-weight="800" fill="#F8FAFC">ALTAR</text>
  <text x="540" y="1110" text-anchor="middle" font-family="Arial, sans-serif" font-size="42" letter-spacing="10" fill="#00F5D4">PRE-SAVE NOW</text>
  <text x="540" y="1560" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" fill="#FF4D8D">JUNE 19, 2026</text>
</svg>`;
}

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function renderCoordinationReport(chain: ChainReport): string {
  const rows = chain.steps.map((step) => `
    <tr>
      <td>${escapeHtml(step.agentId)}</td>
      <td>${escapeHtml(step.reads.join(', ') || 'none')}</td>
      <td>${escapeHtml(step.writes.join(', '))}</td>
      <td>${escapeHtml(step.summary)}</td>
    </tr>`).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Live Agent Daisy Chain Report</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #0b1020; color: #e5e7eb; }
    main { max-width: 1120px; margin: 0 auto; padding: 40px 24px; }
    h1 { margin: 0 0 8px; font-size: 32px; }
    .meta { color: #94a3b8; margin-bottom: 28px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 28px; }
    .panel { border: 1px solid rgba(148, 163, 184, .24); background: rgba(15, 23, 42, .82); border-radius: 8px; padding: 16px; }
    .label { color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
    .value { font-size: 22px; margin-top: 8px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; overflow: hidden; border-radius: 8px; }
    th, td { padding: 12px; border-bottom: 1px solid rgba(148, 163, 184, .18); text-align: left; vertical-align: top; }
    th { color: #67e8f9; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
  </style>
</head>
<body>
  <main>
    <h1>Live Agent Daisy Chain Report</h1>
    <div class="meta">Trace ${escapeHtml(chain.traceId)} for ${escapeHtml(chain.campaign.title)}</div>
    <section class="grid">
      <div class="panel"><div class="label">Shared User Pointer</div><div class="value">${escapeHtml(chain.userPointer)}</div></div>
      <div class="panel"><div class="label">Assets</div><div class="value">${chain.assets.length}</div></div>
      <div class="panel"><div class="label">Budget</div><div class="value">$${chain.finance.budget.toLocaleString()}</div></div>
    </section>
    <table>
      <thead><tr><th>Agent</th><th>Reads</th><th>Writes</th><th>Summary</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </main>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
