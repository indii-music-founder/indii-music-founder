import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { buildAgentHarnessSkillResponse, buildUnavailableToolResponse, type HarnessCatalogEntry } from './toolResponses.js';
const server = new Server(
  {
    name: 'indii-harness-mcp',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Catalog data from shared catalog definition (replicated or loaded)
const HARNESS_CATALOG: HarnessCatalogEntry[] = [
  { domain: 'artist_memory', name: 'Artist Memory / Operating Model', ownerAgentId: 'keeper', supportingAgentIds: ['creative', 'finance', 'legal'], riskRequired: 'read' },
  { domain: 'song_dna', name: 'Song DNA / Creative Intake', ownerAgentId: 'music', supportingAgentIds: ['marketing', 'legal', 'distribution'], riskRequired: 'read' },
  { domain: 'creator_protection', name: 'AI Digital Replica & Creator Protection', ownerAgentId: 'legal', supportingAgentIds: ['security', 'distribution', 'publishing'], riskRequired: 'approval_required' },
  { domain: 'distribution_ddex', name: 'Distribution / DDEX', ownerAgentId: 'distribution', supportingAgentIds: ['legal', 'publishing'], riskRequired: 'blocked_without_user_approval' },
  { domain: 'release', name: 'Release Harness', ownerAgentId: 'distribution', supportingAgentIds: ['marketing', 'creative', 'finance', 'legal'], riskRequired: 'approval_required' },
  { domain: 'finance', name: 'Finance Harness', ownerAgentId: 'finance', supportingAgentIds: ['finance.accounting', 'finance.tax', 'finance.royalty'], riskRequired: 'read' },
  { domain: 'activity_time_value', name: 'Activity / Time Value', ownerAgentId: 'finance', supportingAgentIds: ['keeper'], riskRequired: 'read' },
  { domain: 'road_travel', name: 'Road / Travel', ownerAgentId: 'road', supportingAgentIds: ['finance', 'legal'], riskRequired: 'approval_required' },
  { domain: 'gear_asset', name: 'Gear / Asset', ownerAgentId: 'finance', supportingAgentIds: ['music', 'road'], riskRequired: 'read' },
  { domain: 'merch_pod', name: 'Merch / Print-on-Demand', ownerAgentId: 'merchandise', supportingAgentIds: ['finance', 'legal', 'brand'], riskRequired: 'approval_required' },
  { domain: 'marketing_growth', name: 'Marketing / Growth', ownerAgentId: 'marketing', supportingAgentIds: ['social', 'publicist', 'brand'], riskRequired: 'approval_required' },
  { domain: 'fan_crm', name: 'Fan / CRM', ownerAgentId: 'marketing', supportingAgentIds: ['social', 'merchandise', 'road'], riskRequired: 'read' },
  { domain: 'publishing_rights', name: 'Publishing / Rights', ownerAgentId: 'publishing', supportingAgentIds: ['legal', 'finance.royalty'], riskRequired: 'approval_required' },
  { domain: 'collaboration_splits', name: 'Collaboration / Splits', ownerAgentId: 'legal', supportingAgentIds: ['publishing', 'finance'], riskRequired: 'approval_required' },
  { domain: 'licensing_sync', name: 'Licensing / Sync', ownerAgentId: 'licensing', supportingAgentIds: ['legal', 'publishing'], riskRequired: 'approval_required' },
  { domain: 'royalty_revenue', name: 'Royalty / Revenue', ownerAgentId: 'finance.royalty', supportingAgentIds: ['publishing', 'distribution'], riskRequired: 'read' },
  { domain: 'legal_compliance', name: 'Legal / Compliance', ownerAgentId: 'legal', supportingAgentIds: ['legal.contracts', 'legal.compliance', 'security'], riskRequired: 'approval_required' },
  { domain: 'creative_production', name: 'Creative Production', ownerAgentId: 'creative', supportingAgentIds: ['producer', 'director', 'video'], riskRequired: 'read' },
  { domain: 'opportunity', name: 'Opportunity', ownerAgentId: 'generalist', supportingAgentIds: ['finance', 'legal', 'marketing'], riskRequired: 'approval_required' },
  { domain: 'education_curriculum', name: 'Education / Curriculum', ownerAgentId: 'curriculum', supportingAgentIds: ['keeper'], riskRequired: 'read' },
  { domain: 'security_trust', name: 'Security / Trust', ownerAgentId: 'security', supportingAgentIds: ['legal', 'devops'], riskRequired: 'blocked_without_user_approval' },
  { domain: 'boardroom_meta', name: 'Boardroom Meta-Harness', ownerAgentId: 'generalist', supportingAgentIds: ['finance', 'legal', 'distribution', 'marketing', 'road', 'merchandise'], riskRequired: 'blocked_without_user_approval' },
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_harness_catalog',
        description: 'Exposes the full harness domain catalog, showing primary owners and supporting agents.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'compile_harness',
        description: 'Unavailable until the shared harness backend is wired into this MCP server. Returns an explicit error instead of fabricating a HarnessRun.',
        inputSchema: {
          type: 'object',
          properties: {
            domain: { type: 'string', description: 'Domain catalog key (e.g. creator_protection, song_dna)' },
            projectId: { type: 'string' },
            releaseId: { type: 'string' },
            trackId: { type: 'string' },
            save: { type: 'boolean', description: 'Set true to persist; requires user confirmation round-trip' },
            payload: { type: 'object' },
          },
          required: ['domain'],
        },
      },
      {
        name: 'get_harness_run',
        description: 'Unavailable until the shared harness backend can persist and retrieve runs.',
        inputSchema: {
          type: 'object',
          properties: {
            runId: { type: 'string' },
            projectId: { type: 'string' },
          },
          required: ['runId'],
        },
      },
      {
        name: 'list_harness_runs',
        description: 'Unavailable until the shared harness backend can persist and retrieve runs.',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string' },
            count: { type: 'number' },
          },
        },
      },
      {
        name: 'get_agent_harness_skill',
        description: 'Returns static catalog guidance for an agent. Does not fabricate run state.',
        inputSchema: {
          type: 'object',
          properties: {
            agentId: { type: 'string' },
          },
          required: ['agentId'],
        },
      },
      {
        name: 'get_agent_harness_brief',
        description: 'Unavailable until the shared harness backend can produce actual agent briefs from a persisted harness run.',
        inputSchema: {
          type: 'object',
          properties: {
            runId: { type: 'string' },
            agentId: { type: 'string' },
          },
          required: ['runId', 'agentId'],
        },
      },
      {
        name: 'create_boardroom_decision',
        description: 'Unavailable until the shared harness backend can supply real HarnessRun inputs.',
        inputSchema: {
          type: 'object',
          properties: {
            runIds: { type: 'array', items: { type: 'string' } },
            projectId: { type: 'string' },
          },
          required: ['runIds'],
        },
      },
      {
        name: 'explain_approval_gates',
        description: 'Unavailable until the shared harness backend can supply real HarnessRun inputs.',
        inputSchema: {
          type: 'object',
          properties: {
            runId: { type: 'string' },
          },
          required: ['runId'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'list_harness_catalog') {
    return { content: [{ type: 'text', text: JSON.stringify(HARNESS_CATALOG, null, 2) }] };
  }

  if (name === 'compile_harness') {
    const domain = String(args?.domain ?? '');
    if (!domain || !HARNESS_CATALOG.some(entry => entry.domain === domain)) {
      return buildUnavailableToolResponse('compile_harness', `Unknown harness domain '${domain || '(missing)'}'.`);
    }
    return buildUnavailableToolResponse('compile_harness', [
      domain ? `Domain '${domain}' is cataloged, but no Node-side harness executor is wired into this MCP server yet.` : 'No domain was supplied.',
      'The real harness compilers currently live in the renderer runtime and depend on browser/Firebase context.',
      'Return an explicit error instead of fabricating a HarnessRun.',
    ].join(' '));
  }

  if (name === 'get_harness_run') {
    return buildUnavailableToolResponse('get_harness_run', 'Harness run persistence is not wired into this MCP server yet, so there is no durable run store to read from.');
  }

  if (name === 'list_harness_runs') {
    return buildUnavailableToolResponse('list_harness_runs', 'Harness run persistence is not wired into this MCP server yet, so there is no run index to list.');
  }

  if (name === 'get_agent_harness_skill') {
    const agentId = String(args?.agentId);
    const catalogEntry = HARNESS_CATALOG.find(entry => entry.ownerAgentId === agentId || entry.supportingAgentIds.includes(agentId));
    if (!catalogEntry) {
      return buildUnavailableToolResponse('get_agent_harness_skill', `No harness catalog entry was found for agent '${agentId}'.`);
    }
    return buildAgentHarnessSkillResponse(agentId, catalogEntry);
  }

  if (name === 'get_agent_harness_brief') {
    return buildUnavailableToolResponse('get_agent_harness_brief', 'Agent briefs depend on a persisted HarnessRun, which this MCP server does not yet create or store.');
  }

  if (name === 'create_boardroom_decision') {
    return buildUnavailableToolResponse('create_boardroom_decision', 'Boardroom decisions require persisted HarnessRun inputs. This MCP server does not yet maintain that backing state.');
  }

  if (name === 'explain_approval_gates') {
    return buildUnavailableToolResponse('explain_approval_gates', 'Approval gate explanations require a real HarnessRun. This MCP server does not yet read persisted runs.');
  }

  throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP Server indii-harness-mcp running on stdio');
}

run().catch(console.error);
