#!/usr/bin/env node
/**
 * Sync fine-tuned endpoint IDs from Vertex AI tuningJobs REST API.
 *
 * Usage: node scripts/sync-fine-tuned-endpoints.mjs
 *
 * Requires: gcloud CLI authenticated (gcloud auth login)
 * Fetches: tuningJobs from Vertex (location: VERTEX_TUNING_LOCATION or us-central1, picks latest per agent by endTime)
 * Writes: packages/renderer/src/services/agent/fine-tuned-endpoints.generated.ts
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ID = process.env.VERTEX_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'indii-music-founder';
const LOCATION = process.env.VERTEX_TUNING_LOCATION || 'us-central1';
const OUTPUT_FILE = path.join(__dirname, '../packages/renderer/src/services/agent/fine-tuned-endpoints.generated.ts');

function getVertexAIBaseUrl(location) {
  return location === 'global' || location === 'us' || location === 'eu'
    ? 'https://aiplatform.googleapis.com'
    : `https://${location}-aiplatform.googleapis.com`;
}

async function getAccessToken() {
  return new Promise((resolve, reject) => {
    const proc = spawn('gcloud', ['auth', 'print-access-token'], { stdio: 'pipe' });
    let token = '';
    proc.stdout.on('data', (d) => { token += d.toString(); });
    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(`gcloud auth failed (code ${code})`));
      else resolve(token.trim());
    });
  });
}

async function fetchTuningJobs(token) {
  const url = `${getVertexAIBaseUrl(LOCATION)}/v1/projects/${PROJECT_ID}/locations/${LOCATION}/tuningJobs?pageSize=200`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Vertex API failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return data.tuningJobs || [];
}

function extractAgentId(displayName) {
  // Strip 'r8-' prefix and '-3.1-flash-lite-2026-06-20' suffix
  return displayName.replace(/^r8-/, '').replace(/-3\.1-flash-lite-.*$/, '');
}

function buildRegistry(jobs) {
  const byAgent = new Map();
  for (const job of jobs) {
    if (job.state !== 'JOB_STATE_SUCCEEDED' || !job.tunedModel?.endpoint) continue;
    const agentId = extractAgentId(job.tunedModelDisplayName);
    const current = byAgent.get(agentId);
    if (!current || new Date(job.endTime) > new Date(current.endTime)) {
      byAgent.set(agentId, job);
    }
  }

  const registry = {};
  for (const [agentId, job] of byAgent.entries()) {
    registry[agentId] = job.tunedModel.endpoint;
  }
  return registry;
}

function generateFile(registry) {
  const entries = Object.entries(registry)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `  ${k}: '${v}',`)
    .join('\n');

  const now = new Date().toISOString().split('T')[0];
  return `/**
 * GENERATED FILE — DO NOT EDIT BY HAND
 *
 * Regen command: node scripts/sync-fine-tuned-endpoints.mjs
 * Source: Vertex AI tuningJobs REST API (location: us, latest per agent by endTime)
 * Last synced: ${now}
 *
 * This file is the single source of truth for agent→Vertex endpoint routing.
 * See Platinum Anti-Pattern #9 ("Hardcoded Infrastructure Identifiers") in docs/PLATINUM_QUALITY_STANDARDS.md
 */

export const R8_ENDPOINTS: Record<string, string> = {
${entries}
};
`;
}

async function main() {
  try {
    console.log('Syncing fine-tuned endpoints...');
    const token = await getAccessToken();
    console.log('✓ Auth token obtained');

    const jobs = await fetchTuningJobs(token);
    console.log(`✓ Fetched ${jobs.length} tuning jobs`);

    const registry = buildRegistry(jobs);
    console.log(`✓ Built registry for ${Object.keys(registry).length} agents`);

    const content = generateFile(registry);
    fs.writeFileSync(OUTPUT_FILE, content, 'utf8');
    console.log(`✓ Wrote ${OUTPUT_FILE}`);

    console.log('\nRegistry snapshot:');
    Object.entries(registry).sort().forEach(([k, v]) => {
      console.log(`  ${k}: ${v.split('/').pop()}`);
    });
  } catch (err) {
    console.error(`✗ Error: ${err.message}`);
    console.error('\nFallback: hand-write fine-tuned-endpoints.generated.ts from the plan.');
    process.exit(1);
  }
}

main();
