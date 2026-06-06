import type { HarnessDomain } from '@/services/business-harness/types';

export const ENTRY_COMMAND_SURFACES = ['dashboard', 'command-bar', 'mobile', 'capture', 'voice'] as const;

export type EntryCommandSurface = typeof ENTRY_COMMAND_SURFACES[number];
export type EntryCommandStatus = 'idle' | 'collecting' | 'ready' | 'running' | 'completed' | 'blocked';
export type EntryCommandLaunchMode = 'guided-chat' | 'navigate' | 'workflow';

export interface EntryCommandField {
  id: string;
  label: string;
  prompt: string;
  required?: boolean;
}

export interface EntryCommandDefinition {
  id: string;
  slash: string;
  aliases: string[];
  title: string;
  summary: string;
  surfaces: EntryCommandSurface[];
  intakeFields: EntryCommandField[];
  harnessDomain?: HarnessDomain;
  workflowId?: string;
  launchMode: EntryCommandLaunchMode;
  outputContract: string;
  approvalRequiredFor: string[];
  resumeBehavior: string;
  isCustom?: boolean;
  createdAt?: number;
  sourceSummary?: string;
}

export interface EntryCommandWorkflowState {
  activeCommandId: string | null;
  status: EntryCommandStatus;
  answers: Record<string, string>;
  missingFields: string[];
  workflowExecutionId: string | null;
  harnessRunId: string | null;
  source: EntryCommandSurface | null;
  startedAt: number | null;
  updatedAt: number | null;
}

export const EMPTY_ENTRY_COMMAND_STATE: EntryCommandWorkflowState = {
  activeCommandId: null,
  status: 'idle',
  answers: {},
  missingFields: [],
  workflowExecutionId: null,
  harnessRunId: null,
  source: null,
  startedAt: null,
  updatedAt: null,
};

export const ENTRY_COMMANDS: EntryCommandDefinition[] = [
  {
    id: 'analyze-brand',
    slash: '/analyze-brand',
    aliases: ['/brand-audit', '/audit-brand'],
    title: 'Analyze Brand',
    summary: 'Audit artist identity, visuals, voice, and release fit.',
    surfaces: ['dashboard', 'command-bar'],
    harnessDomain: 'creative_production',
    launchMode: 'guided-chat',
    intakeFields: [
      { id: 'artist', label: 'Artist or project', prompt: 'What artist, project, or release should I audit?', required: true },
      { id: 'assets', label: 'Reference assets', prompt: 'Share the assets, links, or describe the visual system you want reviewed.' },
    ],
    outputContract: 'Brand audit brief with strengths, inconsistencies, missing assets, and next actions.',
    approvalRequiredFor: [],
    resumeBehavior: 'Resume with the last missing brand context question.',
  },
  {
    id: 'create-video',
    slash: '/create-video',
    aliases: ['/video-brief', '/music-video'],
    title: 'Create Video',
    summary: 'Build a guided music-video brief and production/generation plan.',
    surfaces: ['dashboard', 'command-bar'],
    harnessDomain: 'creative_production',
    launchMode: 'guided-chat',
    intakeFields: [
      { id: 'track', label: 'Track', prompt: 'Which track or release is this video for?', required: true },
      { id: 'concept', label: 'Concept', prompt: 'What story, mood, or visual reference should guide it?', required: true },
      { id: 'format', label: 'Format', prompt: 'Do you need full video, vertical clips, teaser, lyric video, or all of those?' },
    ],
    outputContract: 'Creative brief, shot list, format plan, and generation-ready prompts.',
    approvalRequiredFor: ['video generation spend', 'public publishing'],
    resumeBehavior: 'Resume at the next missing creative brief field.',
  },
  {
    id: 'build-release',
    slash: '/build-release',
    aliases: ['/release', '/release-build'],
    title: 'Build Release',
    summary: 'Collect metadata and readiness checks for a distribution release.',
    surfaces: ['dashboard', 'command-bar'],
    harnessDomain: 'release',
    workflowId: 'CAMPAIGN_LAUNCH',
    launchMode: 'guided-chat',
    intakeFields: [
      { id: 'releaseTitle', label: 'Release title', prompt: 'What is the release title?', required: true },
      { id: 'artist', label: 'Artist', prompt: 'What artist name should appear on the release?', required: true },
      { id: 'timeline', label: 'Timeline', prompt: 'What target release date or window are you aiming for?' },
    ],
    outputContract: 'Release readiness checklist, missing metadata, QC warnings, and distribution next actions.',
    approvalRequiredFor: ['distribution submission'],
    resumeBehavior: 'Resume release intake until metadata is ready for QC.',
  },
  {
    id: 'write-copy',
    slash: '/write-copy',
    aliases: ['/copy', '/press-copy'],
    title: 'Write Copy',
    summary: 'Draft press, social, and campaign copy from release context.',
    surfaces: ['dashboard', 'command-bar'],
    harnessDomain: 'marketing_growth',
    launchMode: 'guided-chat',
    intakeFields: [
      { id: 'asset', label: 'Asset', prompt: 'What release, event, product, or story is this copy for?', required: true },
      { id: 'audience', label: 'Audience', prompt: 'Who needs to read this: fans, press, venues, playlist curators, or buyers?' },
      { id: 'tone', label: 'Tone', prompt: 'What tone should it carry?' },
    ],
    outputContract: 'Copy package with approved angles, drafts, and channel variants.',
    approvalRequiredFor: ['public posting', 'email or SMS send'],
    resumeBehavior: 'Resume with the copy package context still attached.',
  },
  {
    id: 'design-cover',
    slash: '/design-cover',
    aliases: ['/cover', '/cover-art'],
    title: 'Design Cover',
    summary: 'Create a full cover-art package from guided creative intake.',
    surfaces: ['dashboard', 'command-bar'],
    harnessDomain: 'creative_production',
    launchMode: 'guided-chat',
    intakeFields: [
      { id: 'releaseTitle', label: 'Release title', prompt: 'What is the title for the cover?', required: true },
      { id: 'vibe', label: 'Vibe', prompt: 'What emotional world should the cover live in?', required: true },
      { id: 'references', label: 'References', prompt: 'Any visual references, colors, symbols, or things to avoid?' },
    ],
    outputContract: 'Cover concepts, generation prompts, final image handoff, and release/social crop specs.',
    approvalRequiredFor: ['final image generation', 'public release asset selection'],
    resumeBehavior: 'Resume with the selected direction and remaining image package tasks.',
  },
  {
    id: 'scout-venues',
    slash: '/scout-venues',
    aliases: ['/venues', '/tour-venues'],
    title: 'Scout Venues',
    summary: 'Plan venue targets for shows or tour routing.',
    surfaces: ['dashboard', 'command-bar'],
    harnessDomain: 'road_travel',
    workflowId: 'TOUR_PLANNING',
    launchMode: 'guided-chat',
    intakeFields: [
      { id: 'cities', label: 'Cities', prompt: 'Which cities or region should I scout?', required: true },
      { id: 'capacity', label: 'Capacity', prompt: 'What room size or crowd range fits this run?' },
      { id: 'dates', label: 'Dates', prompt: 'What dates or season are you targeting?' },
    ],
    outputContract: 'Venue shortlist, routing assumptions, outreach targets, and cost/logistics notes.',
    approvalRequiredFor: ['venue outreach', 'booking commitment'],
    resumeBehavior: 'Resume with the selected city or venue list.',
  },
  {
    id: 'plan-campaign',
    slash: '/plan-campaign',
    aliases: ['/campaign', '/launch-campaign'],
    title: 'Plan Campaign',
    summary: 'Build a campaign plan tied to release and growth goals.',
    surfaces: ['dashboard', 'command-bar'],
    harnessDomain: 'marketing_growth',
    workflowId: 'CAMPAIGN_LAUNCH',
    launchMode: 'guided-chat',
    intakeFields: [
      { id: 'goal', label: 'Goal', prompt: 'What is the campaign trying to make happen?', required: true },
      { id: 'release', label: 'Release or asset', prompt: 'Which release, event, or product is the campaign for?', required: true },
      { id: 'window', label: 'Window', prompt: 'What date range should the campaign cover?' },
    ],
    outputContract: 'Campaign strategy, channel plan, content calendar, and approval gates for public sends.',
    approvalRequiredFor: ['ad spend', 'email or SMS send', 'public posting'],
    resumeBehavior: 'Resume from the active campaign brief and next missing launch detail.',
  },
  {
    id: 'review-contract',
    slash: '/review-contract',
    aliases: ['/contract-review', '/legal-review'],
    title: 'Review Contract',
    summary: 'Collect contract context and route legal review safely.',
    surfaces: ['dashboard', 'command-bar'],
    harnessDomain: 'legal_compliance',
    launchMode: 'guided-chat',
    intakeFields: [
      { id: 'contractType', label: 'Contract type', prompt: 'What kind of agreement is this?', required: true },
      { id: 'document', label: 'Document', prompt: 'Attach or paste the relevant contract text.', required: true },
    ],
    outputContract: 'Issue list, negotiation points, risk summary, and attorney escalation packet if needed.',
    approvalRequiredFor: ['attorney escalation', 'contract send or signature'],
    resumeBehavior: 'Resume from the last reviewed clause or missing document.',
  },
  {
    id: 'track-revenue',
    slash: '/track-revenue',
    aliases: ['/revenue', '/royalties'],
    title: 'Track Revenue',
    summary: 'Review royalty and revenue signals.',
    surfaces: ['dashboard', 'command-bar'],
    harnessDomain: 'royalty_revenue',
    launchMode: 'guided-chat',
    intakeFields: [
      { id: 'period', label: 'Period', prompt: 'What period should I analyze?', required: true },
      { id: 'source', label: 'Source', prompt: 'Which platform, distributor, or statement should I use?' },
    ],
    outputContract: 'Revenue summary, missing statements, anomalies, and follow-up tasks.',
    approvalRequiredFor: [],
    resumeBehavior: 'Resume from the latest imported statement or requested period.',
  },
  {
    id: 'tour-merch',
    slash: '/tour-merch',
    aliases: ['/sell-shirts', '/merch-workflow', '/shirt-sale'],
    title: 'Tour Merch',
    summary: 'Turn merch interest into a POD-backed quote and fulfillment workflow.',
    surfaces: ['command-bar', 'mobile', 'voice'],
    harnessDomain: 'merch_pod',
    launchMode: 'guided-chat',
    intakeFields: [
      { id: 'productType', label: 'Product', prompt: 'What product are you selling?', required: true },
      { id: 'provider', label: 'POD provider', prompt: 'Which POD provider should I use: Printful, Printify, Gooten, or internal?', required: true },
      { id: 'targetRetailPrice', label: 'Retail price', prompt: 'What do you want to charge?', required: true },
      { id: 'expectedUnits', label: 'Units', prompt: 'How many units should I estimate?', required: true },
    ],
    outputContract: 'POD margin quote, provider readiness, sample/order approval gate, and fulfillment next step.',
    approvalRequiredFor: ['sample order', 'manufacturing order', 'storefront publish', 'paid checkout'],
    resumeBehavior: 'Resume from quote or approval gate without placing paid orders automatically.',
  },
  {
    id: 'capture-contact',
    slash: '/capture-contact',
    aliases: ['/new-contact', '/met-someone', '/contact'],
    title: 'Capture Contact',
    summary: 'Capture a field contact from messy mobile or voice input.',
    surfaces: ['command-bar', 'mobile', 'capture', 'voice'],
    harnessDomain: 'fan_crm',
    launchMode: 'guided-chat',
    intakeFields: [
      { id: 'name', label: 'Name', prompt: 'Who did you meet?', required: true },
      { id: 'contactMethod', label: 'Contact method', prompt: 'What phone, email, or Instagram did they share?' },
    ],
    outputContract: 'Structured field contact saved with source, context, consent notes, and future follow-up eligibility.',
    approvalRequiredFor: ['email send', 'SMS send', 'campaign enrollment'],
    resumeBehavior: 'Resume contact capture until a name is saved or the user cancels.',
  },
  {
    id: 'save-command',
    slash: '/save-command',
    aliases: ['/promote-command', '/make-command', '/command-from-this'],
    title: 'Save Command',
    summary: 'Turn the current conversation into a reusable custom slash workflow.',
    surfaces: ['command-bar', 'mobile', 'voice'],
    launchMode: 'guided-chat',
    intakeFields: [
      { id: 'commandName', label: 'Command name', prompt: 'What slash command should I save, such as /shirt?', required: true },
      { id: 'purpose', label: 'Purpose', prompt: 'What should this command repeat from the conversation?' },
    ],
    outputContract: 'Custom slash command draft with intake fields, domain mapping, approval gates, and resume behavior.',
    approvalRequiredFor: ['saving reusable automation'],
    resumeBehavior: 'Resume command drafting until a valid non-conflicting slash command is saved.',
  },
  {
    id: 'custom-workflow',
    slash: '/custom-workflow',
    aliases: ['/workflow', '/workflow-lab'],
    title: 'Custom Workflow',
    summary: 'Open Workflow Lab for custom automation design.',
    surfaces: ['dashboard', 'command-bar'],
    launchMode: 'navigate',
    intakeFields: [],
    outputContract: 'Workflow Lab opened for custom node-based automation.',
    approvalRequiredFor: [],
    resumeBehavior: 'Workflow Lab manages its own save and resume lifecycle.',
  },
];

const COMMANDS_BY_ID = new Map(ENTRY_COMMANDS.map(command => [command.id, command]));
const COMMANDS_BY_SLASH = new Map<string, EntryCommandDefinition>();
const CUSTOM_ENTRY_COMMANDS_STORAGE_KEY = 'indii_custom_entry_commands_v1';

for (const command of ENTRY_COMMANDS) {
  COMMANDS_BY_SLASH.set(command.slash, command);
  for (const alias of command.aliases) {
    COMMANDS_BY_SLASH.set(alias, command);
  }
}

export function getEntryCommand(id: string): EntryCommandDefinition | undefined {
  return COMMANDS_BY_ID.get(id) || getCustomEntryCommands().find(command => command.id === id);
}

export function resolveEntryCommand(input: string): EntryCommandDefinition | undefined {
  const token = input.trim().split(/\s+/)[0]?.toLowerCase();
  if (!token?.startsWith('/')) return undefined;
  return COMMANDS_BY_SLASH.get(token) || getCustomEntryCommands().find(command =>
    command.slash === token || command.aliases.includes(token)
  );
}

export function getEntryCommandRemainder(input: string): string {
  const trimmed = input.trim();
  const firstSpace = trimmed.search(/\s/);
  return firstSpace === -1 ? '' : trimmed.slice(firstSpace).trim();
}

export function getDashboardEntryCommands(): EntryCommandDefinition[] {
  return ENTRY_COMMANDS.filter(command => command.surfaces.includes('dashboard'));
}

export function getCustomEntryCommands(): EntryCommandDefinition[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_ENTRY_COMMANDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidCustomCommand);
  } catch {
    return [];
  }
}

export function mergeCustomEntryCommands(commands: EntryCommandDefinition[]): EntryCommandDefinition[] {
  const existing = getCustomEntryCommands();
  const merged = [...existing];

  for (const command of commands) {
    const slash = normalizeEntryCommandSlash(command.slash);
    if (!slash || COMMANDS_BY_SLASH.has(slash)) continue;
    const aliases = command.aliases
      .map(alias => normalizeEntryCommandSlash(alias))
      .filter((alias): alias is string => Boolean(alias) && !COMMANDS_BY_SLASH.has(alias));
    const index = merged.findIndex(item => item.id === command.id || item.slash === slash);
    const normalizedCommand: EntryCommandDefinition = {
      ...command,
      slash,
      aliases,
      isCustom: true,
    };
    if (index >= 0) {
      merged[index] = normalizedCommand;
    } else if (!merged.some(item => item.aliases.includes(slash) || aliases.includes(item.slash))) {
      merged.push(normalizedCommand);
    }
  }

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(CUSTOM_ENTRY_COMMANDS_STORAGE_KEY, JSON.stringify(merged));
  }
  return merged;
}

export function saveCustomEntryCommand(command: EntryCommandDefinition): { ok: true; command: EntryCommandDefinition } | { ok: false; reason: string } {
  if (typeof localStorage === 'undefined') {
    return { ok: false, reason: 'Custom commands require browser storage.' };
  }

  const slash = normalizeEntryCommandSlash(command.slash);
  if (!slash) {
    return { ok: false, reason: 'Use a slash command like /shirt with lowercase letters, numbers, or hyphens.' };
  }

  const aliases = command.aliases
    .map(alias => normalizeEntryCommandSlash(alias))
    .filter((alias): alias is string => Boolean(alias) && alias !== slash);
  const slashCandidates = [slash, ...aliases];
  const uniqueCandidates = new Set(slashCandidates);
  if (uniqueCandidates.size !== slashCandidates.length) {
    return { ok: false, reason: 'Custom command aliases must be unique.' };
  }

  const reservedSlash = slashCandidates.find(candidate => COMMANDS_BY_SLASH.has(candidate));
  if (reservedSlash) {
    return { ok: false, reason: `${reservedSlash} is reserved by a built-in command.` };
  }

  const existing = getCustomEntryCommands();
  const existingSlash = slashCandidates.find(candidate =>
    existing.some(item => item.slash === candidate || item.aliases.includes(candidate))
  );
  if (existingSlash) {
    return { ok: false, reason: `${existingSlash} already exists as a custom command.` };
  }

  const savedCommand: EntryCommandDefinition = {
    ...command,
    id: command.id || `custom-${slash.slice(1)}`,
    slash,
    aliases,
    isCustom: true,
    createdAt: command.createdAt || Date.now(),
  };

  localStorage.setItem(CUSTOM_ENTRY_COMMANDS_STORAGE_KEY, JSON.stringify([...existing, savedCommand]));
  return { ok: true, command: savedCommand };
}

export function clearCustomEntryCommands(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(CUSTOM_ENTRY_COMMANDS_STORAGE_KEY);
}

export function getRequiredMissingFields(
  command: EntryCommandDefinition,
  answers: Record<string, string>
): string[] {
  return command.intakeFields
    .filter(field => field.required && !answers[field.id]?.trim())
    .map(field => field.id);
}

export function normalizeEntryCommandSlash(input: string): string | null {
  const raw = input.trim().split(/\s+/)[0] || '';
  const slash = raw.startsWith('/') ? raw : `/${raw}`;
  const normalized = slash.toLowerCase();
  return /^\/[a-z][a-z0-9-]{1,31}$/.test(normalized) ? normalized : null;
}

function isValidCustomCommand(value: unknown): value is EntryCommandDefinition {
  if (!value || typeof value !== 'object') return false;
  const command = value as Partial<EntryCommandDefinition>;
  return Boolean(
    command.isCustom &&
    typeof command.id === 'string' &&
    typeof command.slash === 'string' &&
    normalizeEntryCommandSlash(command.slash) === command.slash &&
    Array.isArray(command.aliases) &&
    typeof command.title === 'string' &&
    typeof command.summary === 'string' &&
    Array.isArray(command.surfaces) &&
    command.surfaces.length > 0 &&
    command.surfaces.every(isEntryCommandSurface) &&
    Array.isArray(command.intakeFields) &&
    typeof command.launchMode === 'string' &&
    typeof command.outputContract === 'string' &&
    Array.isArray(command.approvalRequiredFor) &&
    typeof command.resumeBehavior === 'string'
  );
}

export function isEntryCommandSurface(value: unknown): value is EntryCommandSurface {
  return typeof value === 'string' && (ENTRY_COMMAND_SURFACES as readonly string[]).includes(value);
}
