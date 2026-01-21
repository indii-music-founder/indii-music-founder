/**
 * indii - The AI Agent Orchestration System for indiiOS
 *
 * indii is the intelligent agent system that powers indiiOS, providing
 * AI-driven assistance through a hub-and-spoke architecture.
 */

export const AGENT_SYSTEM_BRANDING = Object.freeze({
  /** The brand name of the agent system */
  name: 'indii',

  /** Full descriptive name */
  fullName: 'indii AI Agent System',

  /** The hub agent in the hub-and-spoke architecture */
  hubName: 'Agent Zero',

  /** Short description for user-facing components */
  description: 'Your AI-powered assistant for independent artists',

  /** Version (should match package.json or be semantic versioned) */
  version: '1.0.0'
} as const);

/**
 * User-facing messages that reference the indii brand
 */
export const INDII_MESSAGES = Object.freeze({
  welcome: 'Welcome to indii, your AI assistant within indiiOS.',
  orchestrating: 'indii is coordinating specialists to help you...',
  error: 'indii encountered an issue:',
  hubSpokeViolation: (source: string, target: string) =>
    `indii architecture rule: Specialist agent '${source}' cannot delegate directly to '${target}'. Specialists must delegate to 'generalist' (Agent Zero), who will coordinate with other specialists as needed.`,
  loopDetected: 'indii detected a potential infinite loop and stopped execution.',
  routingToAgent: (agentName: string) => `indii is routing your request to ${agentName}...`
} as const);
