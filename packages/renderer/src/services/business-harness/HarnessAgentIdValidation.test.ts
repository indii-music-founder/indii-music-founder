import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { VALID_AGENT_IDS } from '@/services/agent/types';
import { PublishingRightsCompiler } from '@/services/publishing/PublishingRightsCompiler';
import { CollaborationSplitsCompiler } from '@/services/collaboration/CollaborationSplitsCompiler';
import { SecurityTrustCompiler } from '@/services/security/SecurityTrustCompiler';
import { ActivityTimeValueCompiler } from '@/services/business-harness/ActivityTimeValueCompiler';
import { OpportunityCompiler } from '@/services/business-harness/OpportunityCompiler';

/**
 * ISSUE-565: Verify all HarnessAgentBrief.agentId and HarnessRecommendation.ownerAgentId
 * resolve to a real ValidAgentId. This test catches the agent-ID mismatch that broke
 * department-gate routing (e.g. 'legal_agent' → 'legal', 'devops_agent' → 'devops').
 */
describe('Harness Agent ID Integrity (ISSUE-565)', () => {
  const validIds = new Set(VALID_AGENT_IDS);

  it('publishing_rights: all agentBriefs and recommendations reference valid agent IDs', () => {
    const compiler = new PublishingRightsCompiler();
     
    const run = compiler.compile({
      songId: 'test-song',
      songTitle: 'Test',
      writers: [],
      proRegistrationStatus: 'unregistered',
      mlcRegistrationStatus: 'unregistered',
    } as any, { userId: 'test-user' });

    const agentIds: string[] = [];
    run.agentBriefs.forEach((brief) => {
      if (brief.agentId) agentIds.push(brief.agentId);
    });
    run.recommendations.forEach((rec) => {
      if (rec.ownerAgentId) agentIds.push(rec.ownerAgentId);
    });

    agentIds.forEach((id) => {
      expect(validIds.has(id as any), `Agent ID "${id}" is not in VALID_AGENT_IDS`).toBe(true);
    });
  });

  it('collaboration_splits: all agentBriefs and recommendations reference valid agent IDs', () => {
    const compiler = new CollaborationSplitsCompiler();
     
    const run = compiler.compile({
      trackTitle: 'Test',
      collaborators: [],
    } as any, { userId: 'test-user' });

    const agentIds: string[] = [];
    run.agentBriefs.forEach((brief) => {
      if (brief.agentId) agentIds.push(brief.agentId);
    });
    run.recommendations.forEach((rec) => {
      if (rec.ownerAgentId) agentIds.push(rec.ownerAgentId);
    });

    agentIds.forEach((id) => {
      expect(validIds.has(id as any), `Agent ID "${id}" is not in VALID_AGENT_IDS`).toBe(true);
    });
  });

  it('security_trust: all agentBriefs and recommendations reference valid agent IDs', () => {
    const compiler = new SecurityTrustCompiler();
     
    const run = compiler.compile({
      actionType: 'api_access',
      eventType: 'test',
    } as any, { userId: 'test-user' });

    const agentIds: string[] = [];
    run.agentBriefs.forEach((brief) => {
      if (brief.agentId) agentIds.push(brief.agentId);
    });
    run.recommendations.forEach((rec) => {
      if (rec.ownerAgentId) agentIds.push(rec.ownerAgentId);
    });

    agentIds.forEach((id) => {
      expect(validIds.has(id as any), `Agent ID "${id}" is not in VALID_AGENT_IDS`).toBe(true);
    });
  });

  it('activity_time_value: all agentBriefs and recommendations reference valid agent IDs', () => {
    const compiler = new ActivityTimeValueCompiler();
     
    const run = compiler.compile({
      events: [],
      hourlyRate: 50,
    } as any, { userId: 'test-user' });

    const agentIds: string[] = [];
    run.agentBriefs.forEach((brief) => {
      if (brief.agentId) agentIds.push(brief.agentId);
    });
    run.recommendations.forEach((rec) => {
      if (rec.ownerAgentId) agentIds.push(rec.ownerAgentId);
    });

    agentIds.forEach((id) => {
      expect(validIds.has(id as any), `Agent ID "${id}" is not in VALID_AGENT_IDS`).toBe(true);
    });
  });

  it('opportunity: all agentBriefs and recommendations reference valid agent IDs', () => {
    const compiler = new OpportunityCompiler();
     
    const run = compiler.compile({
      opportunityId: 'test',
      title: 'Test Opportunity',
      value: 1000,
    } as any, { userId: 'test-user' });

    const agentIds: string[] = [];
    run.agentBriefs.forEach((brief) => {
      if (brief.agentId) agentIds.push(brief.agentId);
    });
    run.recommendations.forEach((rec) => {
      if (rec.ownerAgentId) agentIds.push(rec.ownerAgentId);
    });

    agentIds.forEach((id) => {
      expect(validIds.has(id as any), `Agent ID "${id}" is not in VALID_AGENT_IDS`).toBe(true);
    });
  });
});

/**
 * ISSUE-565 (durable guard): Static scan of harness-brief source.
 *
 * The per-compiler tests above only cover compilers wired into this file, which
 * is exactly how stale ids (RoadTravel `touring`, LicensingSync `creative_agent`,
 * LegalCompliance `legal_agent`/`distribution_agent`, CreativeProduction `merch`,
 * ReleaseHarnessScoring `timeline`) shipped undetected. This block scans every
 * file that actually builds a HarnessAgentBrief / HarnessRecommendation and
 * asserts each agentId/ownerAgentId literal resolves to a ValidAgentId — no
 * per-compiler input construction required.
 *
 * Scope: `agentId` is an overloaded field name (chat roles, event-bus sources,
 * command ids), so we only scan files that reference the harness brief/rec types.
 * `ownerAgentId` is unique to HarnessRecommendation; both live in the same files.
 */
describe('Harness Agent ID Integrity — static source scan (ISSUE-565 durable guard)', () => {
  const validIds = new Set<string>(VALID_AGENT_IDS);
  const SCAN_ROOTS = [
    join(process.cwd(), 'packages/renderer/src'),
    join(process.cwd(), 'packages/shared/src'),
  ];
  const SELF = 'HarnessAgentIdValidation.test.ts';
  // Only files that build harness briefs/recommendations carry the routed id.
  const HARNESS_MARKER = /HarnessAgentBrief|HarnessRecommendation/;

  function walk(dir: string, acc: string[] = []): string[] {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return acc; // root may not exist in some checkout layouts; skip gracefully
    }
    for (const entry of entries) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        if (entry === 'node_modules' || entry === 'dist' || entry === '_archive_legacy') continue;
        walk(full, acc);
      } else if (/\.(ts|tsx)$/.test(entry) && !full.endsWith(SELF)) {
        acc.push(full);
      }
    }
    return acc;
  }

  const harnessFiles = SCAN_ROOTS.flatMap((root) => walk(root)).filter((f) =>
    HARNESS_MARKER.test(readFileSync(f, 'utf8'))
  );
  const sourceFiles = harnessFiles.filter((f) => !/\.test\.(ts|tsx)$/.test(f));
  const testFiles = harnessFiles.filter((f) => /\.test\.(ts|tsx)$/.test(f));

  // Object-literal assignments: agentId: 'x' / ownerAgentId: "x"
  const ASSIGN_RE = /\b(agentId|ownerAgentId)\s*:\s*['"]([^'"]+)['"]/g;
  // Equality comparisons in tests: agentId === 'x' / ownerAgentId == "x"
  const COMPARE_RE = /\b(agentId|ownerAgentId)\s*===?\s*['"]([^'"]+)['"]/g;

  it('scans a non-trivial set of harness files (guard is actually wired)', () => {
    // Regression insurance: if the marker/scope ever silently matches nothing,
    // the offender checks would vacuously pass. Assert real coverage instead.
    expect(sourceFiles.length).toBeGreaterThan(5);
  });

  it('every agentId/ownerAgentId literal in harness source resolves to a ValidAgentId', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles) {
      const content = readFileSync(file, 'utf8');
      for (const m of content.matchAll(ASSIGN_RE)) {
        if (!validIds.has(m[2])) {
          offenders.push(`${file.replace(process.cwd() + '/', '')}: "${m[2]}"`);
        }
      }
    }
    expect(offenders, `Invalid agent ids in harness source:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('every agentId/ownerAgentId equality assertion in harness tests targets a ValidAgentId', () => {
    const offenders: string[] = [];
    for (const file of testFiles) {
      const content = readFileSync(file, 'utf8');
      for (const m of content.matchAll(COMPARE_RE)) {
        if (!validIds.has(m[2])) {
          offenders.push(`${file.replace(process.cwd() + '/', '')}: "${m[2]}"`);
        }
      }
    }
    expect(offenders, `Tests asserting against invalid agent ids:\n${offenders.join('\n')}`).toEqual([]);
  });
});
