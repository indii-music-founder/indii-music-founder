#!/usr/bin/env node
/**
 * Sync fine-tuned endpoint IDs from Vertex AI tuningJobs REST API.
 *
 * Usage: node --import tsx scripts/sync-fine-tuned-endpoints.mjs [--check]
 *
 * Requires: gcloud CLI authenticated (gcloud auth login)
 * Fetches: tuningJobs from Vertex (location: VERTEX_TUNING_LOCATION or us-central1, picks latest per agent by endTime)
 * Writes: renderer agent routing plus Firebase's server admission allowlist.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  resolveVertexEndpointResource,
  resolveVertexLocation,
} from '../packages/firebase/src/lib/vertexRouting.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ID = process.env.VERTEX_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'indii-music-founder';
const LOCATION = process.env.VERTEX_TUNING_LOCATION || 'us-central1';
const OUTPUT_FILE = path.join(__dirname, '../packages/renderer/src/services/agent/fine-tuned-endpoints.generated.ts');
const FIREBASE_POLICY_OUTPUT_FILE = path.join(__dirname, '../packages/firebase/src/config/textStreamModels.ts');

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
  const url = `${resolveVertexLocation(LOCATION).baseUrl}/v1/projects/${PROJECT_ID}/locations/${LOCATION}/tuningJobs?pageSize=200`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Vertex API failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return data.tuningJobs || [];
}

async function preflightEndpoints(token, registry) {
  const resources = [...new Set(Object.values(registry))];
  const failures = [];

  for (const resourceName of resources) {
    try {
      const route = resolveVertexEndpointResource(resourceName);
      const url = `${route.baseUrl}/v1/${route.resourceName}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        failures.push({
          category: res.status === 404 ? 'specialist_unavailable' : 'provider_outage',
          status: res.status,
        });
      }
    } catch (error) {
      failures.push({
        category: 'routing_misconfiguration',
        status: error?.code || 'VERTEX_ROUTING_UNRESOLVED',
      });
    }
  }

  if (failures.length > 0) {
    const counts = failures.reduce((acc, failure) => {
      acc[failure.category] = (acc[failure.category] || 0) + 1;
      return acc;
    }, {});
    throw new Error(`Specialist endpoint preflight failed: ${JSON.stringify(counts)}`);
  }

  return resources.length;
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
 * Regen command: node --import tsx scripts/sync-fine-tuned-endpoints.mjs
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

function generateFirebasePolicyFile(registry) {
  const endpointEntries = [...new Set(Object.values(registry))]
    .sort()
    .map((endpoint) => `  '${endpoint}',`)
    .join('\n');

  return `/**
 * GENERATED FILE — DO NOT EDIT BY HAND
 *
 * Regen command: node --import tsx scripts/sync-fine-tuned-endpoints.mjs
 * Source: Vertex AI tuningJobs REST API (latest succeeded endpoint per agent).
 *
 * Browser requests may name a capability, but only these Vertex base models
 * and reviewed endpoints may consume shared project quota. Endpoint resource
 * names are identifiers, not credentials; accepting any valid-shaped resource
 * would let a modified browser select unreviewed capacity.
 */

export const APPROVED_TEXT_STREAM_BASE_MODELS = new Set([
  'gemini-3.1-pro-preview',
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-pro-preview',
]);

export const APPROVED_TEXT_STREAM_FINE_TUNED_ENDPOINTS = new Set([
${endpointEntries}
]);

export function isApprovedFineTunedTextEndpoint(model: unknown): model is string {
  return typeof model === 'string' && APPROVED_TEXT_STREAM_FINE_TUNED_ENDPOINTS.has(model);
}

export function isApprovedTextStreamModel(model: unknown): model is string {
  return typeof model === 'string'
    && (APPROVED_TEXT_STREAM_BASE_MODELS.has(model) || isApprovedFineTunedTextEndpoint(model));
}
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

    const checkedEndpoints = await preflightEndpoints(token, registry);
    console.log(`✓ Read-only preflight verified ${checkedEndpoints} specialist endpoints`);

    if (process.argv.includes('--check')) {
      console.log('✓ Check-only mode: generated files were not modified');
      return;
    }

    const content = generateFile(registry);
    fs.writeFileSync(OUTPUT_FILE, content, 'utf8');
    console.log(`✓ Wrote ${OUTPUT_FILE}`);
    const firebasePolicy = generateFirebasePolicyFile(registry);
    fs.writeFileSync(FIREBASE_POLICY_OUTPUT_FILE, firebasePolicy, 'utf8');
    console.log(`✓ Wrote ${FIREBASE_POLICY_OUTPUT_FILE}`);

    console.log('\nRegistry snapshot:');
    Object.entries(registry).sort().forEach(([k, v]) => {
      console.log(`  ${k}: ${v.split('/').pop()}`);
    });
  } catch (err) {
    console.error(`✗ Error: ${err.message}`);
    console.error('\nNo files were written. Restore authorization or correct the typed routing/preflight failure, then retry.');
    process.exit(1);
  }
}

main();
