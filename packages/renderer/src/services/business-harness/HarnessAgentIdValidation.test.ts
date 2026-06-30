import { describe, it, expect } from 'vitest';
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
