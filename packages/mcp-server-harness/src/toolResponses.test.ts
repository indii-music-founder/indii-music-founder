import { describe, expect, it } from 'vitest';
import { buildAgentHarnessSkillResponse, buildUnavailableToolResponse } from './toolResponses.js';

describe('harness MCP tool responses', () => {
  it('returns an explicit unavailable response for runtime tools', () => {
    const response = buildUnavailableToolResponse('compile_harness', 'No backend is wired.');

    expect(response.isError).toBe(true);
    expect(response.content[0]?.text).toContain('[UNAVAILABLE] compile_harness');
    expect(response.content[0]?.text).toContain('No backend is wired.');
  });

  it('returns static catalog guidance for agent skill requests', () => {
    const response = buildAgentHarnessSkillResponse('marketing', {
      domain: 'marketing_growth',
      name: 'Marketing / Growth',
      ownerAgentId: 'marketing',
      supportingAgentIds: ['social', 'publicist', 'brand'],
      riskRequired: 'approval_required',
    });

    const text = response.content[0]?.text ?? '';

    expect(text).toContain('"agentId": "marketing"');
    expect(text).toContain('"domain": "marketing_growth"');
    expect(text).toContain('Supporting agents: social, publicist, brand.');
    expect(text).toContain('static catalog guidance');
  });
});
