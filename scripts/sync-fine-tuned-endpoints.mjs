#!/usr/bin/env node
/**
 * Sync fine-tuned endpoint IDs from Vertex AI tuningJobs REST API.
 *
 * Usage: node --import tsx scripts/sync-fine-tuned-endpoints.mjs [--check]
 *
 * Requires: gcloud CLI authenticated (gcloud auth login)
 * Fetches: tuningJobs from Vertex (location: VERTEX_TUNING_LOCATION or us-central1, picks latest per agent by endTime)
 * Writes: renderer agent routing plus Firebase's server admission allowlist.
 *
 * --check: read-only. Preflights live endpoints AND diffs the checked-in registry
 * against live Vertex (stale / missing / added agents); exits non-zero on drift so
 * the `health:vertex-specialists` check fails loudly instead of silently serving
 * stale endpoints (Platinum Anti-Pattern #9).
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
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
    const killer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('gcloud auth timed out after 30s'));
    }, 30000);
    let token = '';
    proc.stdout.on('data', (d) => { token += d.toString(); });
    proc.on('close', (code) => {
      clearTimeout(killer);
      if (code !== 0) reject(new Error(`gcloud auth failed (code ${code})`));
      else resolve(token.trim());
    });
  });
}

async function fetchTuningJobs(token) {
  const url = `${resolveVertexLocation(LOCATION).baseUrl}/v1/projects/${PROJECT_ID}/locations/${LOCATION}/tuningJobs?pageSize=200`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(30000),
    headers: { Authorization: `Bearer ${token}` },
  });
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
      const res = await fetch(url, {
        signal: AbortSignal.timeout(30000),
        headers: { Authorization: `Bearer ${token}` },
      });
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

function parseCheckedInRegistry(sourceText) {
  const registry = {};
  // Match both `key: '...',` and `'hyphen-key': '...',` entries inside R8_ENDPOINTS.
  const entryRe = /^\s{2}'?([a-z][a-z0-9-]*)'?: '([^']+)',$/gm;
  let match;
  while ((match = entryRe.exec(sourceText)) !== null) {
    registry[match[1]] = match[2];
  }
  return registry;
}

function compareRegistries(checkedIn, live) {
  const checkedKeys = Object.keys(checkedIn);
  const liveKeys = Object.keys(live);
  return {
    stale: checkedKeys.filter((k) => live[k] !== undefined && live[k] !== checkedIn[k]),
    missing: checkedKeys.filter((k) => live[k] === undefined),
    added: liveKeys.filter((k) => checkedIn[k] === undefined),
    matching: checkedKeys.filter((k) => live[k] === checkedIn[k]),
  };
}

function hasDrift(comparison) {
  return comparison.stale.length > 0 || comparison.missing.length > 0 || comparison.added.length > 0;
}

function driftDescription(comparison) {
  const parts = [];
  if (comparison.stale.length) parts.push(`${comparison.stale.length} stale (endpoint changed): ${comparison.stale.join(', ')}`);
  if (comparison.missing.length) parts.push(`${comparison.missing.length} missing (no live SUCCEEDED job): ${comparison.missing.join(', ')}`);
  if (comparison.added.length) parts.push(`${comparison.added.length} new (live, not in checked-in): ${comparison.added.join(', ')}`);
  return parts.length ? parts.join('; ') : `in sync (${comparison.matching.length} agents)`;
}

function safeObjectKey(key) {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `'${key}'`;
}

function parseCheckedInPolicyEndpoints(sourceText) {
  const marker = 'APPROVED_TEXT_STREAM_FINE_TUNED_ENDPOINTS = new Set([';
  const start = sourceText.indexOf(marker);
  if (start === -1) return new Set();
  const block = sourceText.slice(start + marker.length);
  const end = block.indexOf(']);');
  const body = end === -1 ? block : block.slice(0, end);
  const endpoints = new Set();
  const entryRe = /^\s*'([^']+)',\s*$/gm;
  let match;
  while ((match = entryRe.exec(body)) !== null) {
    endpoints.add(match[1]);
  }
  return endpoints;
}

function compareEndpointSets(checkedIn, live) {
  return {
    removed: [...checkedIn].filter((e) => !live.has(e)),
    added: [...live].filter((e) => !checkedIn.has(e)),
    matching: [...checkedIn].filter((e) => live.has(e)),
  };
}

function generateFile(registry) {
  const entries = Object.entries(registry)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `  ${safeObjectKey(k)}: '${v}',`)
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

    const comparison = compareRegistries(parseCheckedInRegistry(fs.readFileSync(OUTPUT_FILE, 'utf8')), registry);
    const liveEndpoints = new Set(Object.values(registry));
    const policyComparison = compareEndpointSets(
      parseCheckedInPolicyEndpoints(fs.readFileSync(FIREBASE_POLICY_OUTPUT_FILE, 'utf8')),
      liveEndpoints,
    );

    if (process.argv.includes('--check')) {
      const registryDrift = hasDrift(comparison);
      const policyDrift = policyComparison.removed.length > 0 || policyComparison.added.length > 0;
      if (registryDrift || policyDrift) {
        if (registryDrift) console.error(`✗ Renderer registry out of sync with live Vertex: ${driftDescription(comparison)}`);
        if (policyDrift) console.error(`✗ Firebase admission allowlist out of sync with live Vertex: ${policyComparison.removed.length} removed, ${policyComparison.added.length} added`);
        console.error('  Re-sync by running the sync script without --check, then commit the generated files.');
        process.exit(1);
      }
      console.log(`✓ Check-only mode: renderer registry ${driftDescription(comparison)}; firebase allowlist in sync (${policyComparison.matching.length} endpoints); generated files were not modified`);
      return;
    }

    console.log(`↻ Re-syncing registry (${driftDescription(comparison)}; allowlist ${policyComparison.removed.length} removed, ${policyComparison.added.length} added)`);

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

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main();
}

export {
  parseCheckedInRegistry,
  compareRegistries,
  hasDrift,
  driftDescription,
  safeObjectKey,
  parseCheckedInPolicyEndpoints,
  compareEndpointSets,
  buildRegistry,
  generateFile,
};
