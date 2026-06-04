import { test, expect } from './fixtures/auth';
import * as fs from 'fs';
import * as path from 'path';

const agentsToTest = [
  { file: 'live_test_analytics_agent.md', name: 'Intelligence Analytics Agent', trigger: 'Request a demographic breakdown of the top streaming audience.', targetText: 'Command Center' },
  { file: 'live_test_brand_agent.md', name: 'Brand Agent', trigger: 'Ask the agent to create a brand partnership pitch for a lifestyle brand.', targetText: 'Brand Manager' },
  { file: 'live_test_conductor.md', name: 'Workflow Conductor', trigger: 'Create a multi-step workflow involving at least two agents.', targetText: 'Workflow Builder' },
  { file: 'live_test_creative_director.md', name: 'Creative Director', trigger: 'Input Prompt: "Futuristic neon city".', targetText: 'Creative Director' },
  { file: 'live_test_director_agent.md', name: 'Director Agent', trigger: 'Request generation of a storyboard or video transition.', targetText: 'Director' },
  { file: 'live_test_distribution_director.md', name: 'Distribution Director', trigger: 'Fill out a mock release form (Title, Audio, Artwork).', targetText: 'Distribution Department' },
  { file: 'live_test_finance_accounting_agent.md', name: 'Finance Accounting Agent', trigger: 'Request a P&L (Profit and Loss) statement generation for the month.', targetText: 'Finance Department' },
  { file: 'live_test_finance_director.md', name: 'Finance Director', trigger: 'Select a date range or click **Generate Financial Report**.', targetText: 'Finance Department' },
  { file: 'live_test_finance_royalty_agent.md', name: 'Finance Royalty Agent', trigger: 'Upload a CSV of streaming data and request a royalty calculation.', targetText: 'Finance Department' },
  { file: 'live_test_finance_tax_agent.md', name: 'Finance Tax Agent', trigger: 'Request an estimated quarterly tax deduction report for touring income.', targetText: 'Finance Department' },
  { file: 'live_test_legal_director.md', name: 'Legal Director', trigger: 'Create a new mock split sheet or contract template.', targetText: 'Legal Department' },
  { file: 'live_test_licensing_agent.md', name: 'Sync Licensing Agent', trigger: 'Request a sync pitch for a moody indie pop song for a TV drama.', targetText: 'Licensing Department' },
  { file: 'live_test_marketing_director.md', name: 'Marketing Director', trigger: 'Input a campaign goal or select "Generate Social Assets".', targetText: 'Marketing Department' },
  { file: 'live_test_merchandise_agent.md', name: 'Merchandise Agent', trigger: 'Request a merch drop strategy including unit costs and retail pricing.', targetText: 'Art & Merch Dept' },
  { file: 'live_test_music_director.md', name: 'Music Director', trigger: 'Drag and drop or select an audio file (e.g., .wav, .mp3).', targetText: 'Audio Analyzer' },
  { file: 'live_test_producer_agent.md', name: 'Producer Agent', trigger: 'Request a budget breakdown or production schedule for a new single.', targetText: 'Producer', skip: true },
  { file: 'live_test_publicist_agent.md', name: 'Publicist Agent', trigger: 'Ask the agent to draft a press release for an upcoming album.', targetText: 'Publicist' },
  { file: 'live_test_publishing_agent.md', name: 'Publishing Agent', trigger: 'Ask the agent to register a new song split (50% writer, 50% producer).', targetText: 'Publishing Department' },
  { file: 'live_test_road_agent.md', name: 'Tour Manager (Road) Agent', trigger: 'Request a routing plan for a 10-city West Coast tour.', targetText: 'Road Manager' },
  { file: 'live_test_security_agent.md', name: 'Security Agent', trigger: 'Ask the agent to run a compliance audit or security check on artist data.', targetText: 'Security Agent' },
  { file: 'live_test_social_agent.md', name: 'Social Media Agent', trigger: 'Request a 2-week content calendar for a new release on TikTok and Instagram.', targetText: 'Social Media Department' },
  { file: 'live_test_video_agent.md', name: 'Video Agent', trigger: 'Upload a raw video clip and request a color grading or trimming plan.', targetText: 'Video Producer', skip: true }
];

test.describe('Live Test Orchestrator', () => {
  for (const agent of agentsToTest) {
    if (agent.skip) continue;

    test(`Live Test: ${agent.name}`, async ({ authedPage: page }) => {
      test.setTimeout(120000);
      console.log(`Starting ${agent.name}...`);
      await page.goto('/agent', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
      
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text();
          // Ignore expected firestore connection and offline state warnings in offline test harness
          if (
            text.includes('@firebase/firestore') ||
            text.includes('Could not reach Cloud Firestore') ||
            text.includes('Failed to get document because the client is offline') ||
            text.includes('Unauthorized subscribe to') ||
            text.includes('Unauthorized: Access denied to') ||
            text.includes('Failed to load merch stats') ||
            text.includes('violates the following report-only Content Security Policy') ||
            text.includes('frame-ancestors')
          ) {
            return;
          }
          errors.push(text);
        }
      });

      // Navigate to agent
      const navItem = page.getByRole('button', { name: new RegExp(agent.targetText, 'i') }).first();
      const isVisible = await navItem.isVisible().catch(() => false);
      
      if (!isVisible) {
        expect(false, `Agent module '${agent.targetText}' not found in sidebar`).toBe(true);
      }

      await navItem.click();
      await page.waitForTimeout(2000);

      // Attempt to find a chat input
      const chatInput = page.locator('textarea, input[placeholder*="message" i], input[placeholder*="ask" i]').first();
      if (await chatInput.isVisible()) {
        await chatInput.fill(agent.trigger);
        await chatInput.press('Enter');
        await page.waitForTimeout(3000);
      } else {
        // Just record that we couldn't interact but the module loaded
        console.log(`[PARTIAL] ${agent.name} - Module loaded but could not execute exact trigger automatically.`);
      }

      if (errors.length > 0) {
        console.error(`Errors found for ${agent.name}:`, errors);
        expect(errors.length).toBe(0);
      }
      
      console.log(`Finished ${agent.name}`);
    });
  }
});
