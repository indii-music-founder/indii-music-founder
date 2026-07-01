export interface HarnessCatalogEntry {
  domain: string;
  name: string;
  ownerAgentId: string;
  supportingAgentIds: string[];
  riskRequired: 'read' | 'approval_required' | 'blocked_without_user_approval';
}

export function buildUnavailableToolResponse(toolName: string, reason: string) {
  return {
    content: [
      {
        type: 'text',
        text: `[UNAVAILABLE] ${toolName}: ${reason}`,
      },
    ],
    isError: true,
  };
}

export function buildAgentHarnessSkillResponse(agentId: string, catalogEntry: HarnessCatalogEntry) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          agentId,
          catalogEntry: {
            domain: catalogEntry.domain,
            name: catalogEntry.name,
            ownerAgentId: catalogEntry.ownerAgentId,
            supportingAgentIds: catalogEntry.supportingAgentIds,
            riskRequired: catalogEntry.riskRequired,
          },
          guidance: [
            `Owner agent: ${catalogEntry.ownerAgentId}.`,
            `Supporting agents: ${catalogEntry.supportingAgentIds.join(', ') || 'none'}.`,
            catalogEntry.riskRequired === 'read'
              ? 'This harness is informational only unless a backend run is wired in.'
              : 'This harness requires user approval for irreversible actions.',
          ],
          note: 'This is static catalog guidance, not a fabricated run brief.',
        }, null, 2),
      },
    ],
  };
}
