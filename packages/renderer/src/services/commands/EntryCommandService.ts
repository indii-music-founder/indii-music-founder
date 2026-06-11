import { v4 as uuidv4 } from 'uuid';
import { Timestamp } from 'firebase/firestore';
import { useStore } from '@/core/store';
import { auth } from '@/services/firebase';
import { FieldContactService } from '@/services/contacts/FieldContactService';
import type { FieldContactInput, FieldContactRole } from '@/types/contacts';
import { merchPodHarnessService } from '@/services/business-harness/MerchPodHarnessService';
import type { AgentMessage } from '@/core/store/slices/agent/agentSessionSlice';
import {
  EMPTY_ENTRY_COMMAND_STATE,
  getEntryCommand,
  getEntryCommandRemainder,
  getRequiredMissingFields,
  normalizeEntryCommandSlash,
  resolveEntryCommand,
  type EntryCommandDefinition,
  type EntryCommandSurface,
} from './EntryCommandRegistry';
import { entryCommandSyncService } from './EntryCommandSyncService';

export interface EntryCommandHandleResult {
  handled: boolean;
  responseText?: string;
  agentId?: string;
}

interface LaunchOptions {
  source: EntryCommandSurface;
  includeUserMessage?: boolean;
  remoteCommandId?: string;
}

const PHONE_PATTERN = /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const INSTAGRAM_PATTERN = /(?:^|\s)@([a-zA-Z0-9._]{2,30})/;
const MONEY_PATTERN = /\$?\b(\d+(?:\.\d{1,2})?)\b/;

class EntryCommandService {
  async handleInput(text: string, options: LaunchOptions): Promise<EntryCommandHandleResult> {
    const trimmed = text.trim();
    const promotionAnswers = extractSaveCommandAnswers(text);
    const activeState = getWorkflowState();
    const shouldHydrate = trimmed.startsWith('/') || isSaveCommandIntent(text) || Boolean(activeState.activeCommandId);
    if (shouldHydrate) {
      await entryCommandSyncService.hydrateCustomCommands();
    }

    if (!trimmed.startsWith('/') && isSaveCommandIntent(text) && promotionAnswers.commandName) {
      this.ensureChatSurface(options.source);
      if (options.includeUserMessage !== false) {
        this.addMessage('user', text, undefined, options.source);
      }
      useStore.getState().setEntryCommandWorkflow({
        ...EMPTY_ENTRY_COMMAND_STATE,
        activeCommandId: 'save-command',
        status: 'collecting',
        answers: promotionAnswers,
        missingFields: [],
        source: options.source,
        startedAt: Date.now(),
        updatedAt: Date.now(),
      });
      return this.completeSaveCommand(promotionAnswers, options);
    }

    const command = resolveEntryCommand(text);
    if (command) {
      return this.launch(command.id, getEntryCommandRemainder(text), options);
    }

    if (activeState.activeCommandId && activeState.status === 'collecting') {
      return this.continueActive(text, options);
    }

    return { handled: false };
  }

  async launch(commandId: string, initialText = '', options: LaunchOptions): Promise<EntryCommandHandleResult> {
    const command = getEntryCommand(commandId);
    if (!command) return { handled: false };

    this.ensureChatSurface(options.source);

    if (options.includeUserMessage !== false) {
      this.addMessage('user', initialText ? `${command.slash} ${initialText}` : command.slash, undefined, options.source);
    }

    if (command.launchMode === 'navigate') {
      useStore.getState().setModule('workflow');
      useStore.getState().clearEntryCommandWorkflow();
      const text = 'Opening Workflow Lab so you can build or run a custom automation pipeline.';
      this.addMessage('model', text, command.id, options.source);
      return { handled: true, responseText: text, agentId: command.id };
    }

    const answers = this.extractAnswers(command, initialText);
    const missingFields = getRequiredMissingFields(command, answers);

    useStore.getState().setEntryCommandWorkflow({
      ...EMPTY_ENTRY_COMMAND_STATE,
      activeCommandId: command.id,
      status: 'collecting',
      answers,
      missingFields,
      source: options.source,
      startedAt: Date.now(),
      updatedAt: Date.now(),
    });

    if (isContactCommand(command) && answers.name && hasContactMethod(answers)) {
      return this.completeCaptureContact(command, answers, options);
    }

    if (isMerchCommand(command) && missingFields.length === 0) {
      return this.completeTourMerch(command, answers, options);
    }

    if (command.id === 'save-command' && answers.commandName) {
      return this.completeSaveCommand(answers, options);
    }

    const text = this.buildIntakeMessage(command, answers, missingFields);
    this.addMessage('model', text, command.id, options.source);
    return { handled: true, responseText: text, agentId: command.id };
  }

  private async continueActive(text: string, options: LaunchOptions): Promise<EntryCommandHandleResult> {
    const state = getWorkflowState();
    const command = state.activeCommandId ? getEntryCommand(state.activeCommandId) : undefined;
    if (!command) {
      useStore.getState().clearEntryCommandWorkflow();
      return { handled: false };
    }

    if (options.includeUserMessage !== false) {
      this.addMessage('user', text, undefined, options.source);
    }

    const answers = {
      ...state.answers,
      ...this.extractAnswers(command, text, state.missingFields),
    };
    const missingFields = getRequiredMissingFields(command, answers);

    useStore.getState().updateEntryCommandWorkflow({ answers, missingFields });

    if (isContactCommand(command) && answers.name) {
      if (!hasContactMethod(answers)) {
        const followUp = 'I have the name. What phone, email, or Instagram did they share? If you only got the name, say "save name only".';
        this.addMessage('model', followUp, command.id, options.source);
        return { handled: true, responseText: followUp, agentId: command.id };
      }
      return this.completeCaptureContact(command, answers, options);
    }

    if (isMerchCommand(command) && missingFields.length === 0) {
      return this.completeTourMerch(command, answers, options);
    }

    if (command.id === 'save-command' && answers.commandName) {
      return this.completeSaveCommand(answers, options);
    }

    if (missingFields.length > 0) {
      const followUp = this.buildIntakeMessage(command, answers, missingFields);
      this.addMessage('model', followUp, command.id, options.source);
      return { handled: true, responseText: followUp, agentId: command.id };
    }

    const readyText = this.buildReadyMessage(command, answers);
    useStore.getState().updateEntryCommandWorkflow({ status: 'ready' });
    this.addMessage('model', readyText, command.id, options.source);
    return { handled: true, responseText: readyText, agentId: command.id };
  }

  private async completeCaptureContact(
    command: EntryCommandDefinition,
    answers: Record<string, string>,
    options: LaunchOptions
  ): Promise<EntryCommandHandleResult> {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      const text = 'I can capture that contact after you sign in.';
      this.addMessage('model', text, command.id, options.source);
      useStore.getState().updateEntryCommandWorkflow({ status: 'blocked' });
      return { handled: true, responseText: text, agentId: command.id };
    }

    const location = await FieldContactService.getCurrentLocation();
    const input: FieldContactInput = {
      name: answers.name,
      phone: answers.phone || undefined,
      email: answers.email || undefined,
      instagram: answers.instagram || undefined,
      role: normalizeRole(answers.role || answers.notes),
      notes: buildContactNotes(answers),
      capturedAt: Timestamp.now(),
      capturedLocation: location || undefined,
      capturedContext: answers.context || FieldContactService.buildContextString(location),
      source: 'quick_capture',
    };

    const contactId = await FieldContactService.addFieldContact(uid, input);
    useStore.getState().setEntryCommandWorkflow({
      ...getWorkflowState(),
      status: 'completed',
      harnessRunId: contactId,
      missingFields: [],
      updatedAt: Date.now(),
    });

    const text = `Saved ${input.name} to field contacts. Source context is attached for CRM follow-up; email or SMS outreach will still require a separate approval.`;
    this.addMessage('model', text, command.id, options.source, { contactId });
    return { handled: true, responseText: text, agentId: command.id };
  }

  private async completeTourMerch(
    command: EntryCommandDefinition,
    answers: Record<string, string>,
    options: LaunchOptions
  ): Promise<EntryCommandHandleResult> {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      const text = 'I can build the merch workflow after you sign in.';
      this.addMessage('model', text, command.id, options.source);
      useStore.getState().updateEntryCommandWorkflow({ status: 'blocked' });
      return { handled: true, responseText: text, agentId: command.id };
    }

    const provider = normalizeProvider(answers.provider);
    const targetRetailPrice = parseMoney(answers.targetRetailPrice) || 30;
    const expectedUnits = parseInteger(answers.expectedUnits) || 25;
    const baseCost = parseMoney(answers.baseCost) || estimateBaseCost(answers.productType);
    const shippingEstimate = parseMoney(answers.shippingEstimate) || 6;
    const state = useStore.getState();

    const run = merchPodHarnessService.compile({
      userId: uid,
      projectId: state.currentProjectId || undefined,
      dropGoal: 'tour_table',
      skus: [{
        productType: answers.productType || 't-shirt',
        provider,
        baseCost,
        shippingEstimate,
        targetRetailPrice,
        expectedUnits,
      }],
    }, {
      userId: uid,
      projectId: state.currentProjectId || undefined,
    });

    useStore.getState().setEntryCommandWorkflow({
      ...getWorkflowState(),
      status: 'completed',
      harnessRunId: run.runId,
      missingFields: [],
      updatedAt: Date.now(),
    });

    const rec = run.output.recommendations[0];
    const text = [
      `Built a tour merch quote for ${rec?.productType || answers.productType}.`,
      rec ? `Provider: ${rec.provider}. Retail: $${rec.retailPrice}. Landed cost estimate: $${rec.landedCost}. Gross margin: ${Math.round(rec.grossMargin * 100)}%.` : '',
      'Next approval gate: sample order, manufacturing order, storefront publish, or paid checkout. I will not execute any paid or public action without approval.',
    ].filter(Boolean).join('\n\n');
    this.addMessage('model', text, command.id, options.source, { harnessRunId: run.runId });
    return { handled: true, responseText: text, agentId: command.id };
  }

  private async completeSaveCommand(
    answers: Record<string, string>,
    options: LaunchOptions
  ): Promise<EntryCommandHandleResult> {
    const slash = normalizeEntryCommandSlash(answers.commandName || '');
    if (!slash) {
      const text = 'I need a valid slash command name like /shirt. Use lowercase letters, numbers, or hyphens.';
      this.addMessage('model', text, 'save-command', options.source);
      useStore.getState().updateEntryCommandWorkflow({ status: 'collecting', missingFields: ['commandName'] });
      return { handled: true, responseText: text, agentId: 'save-command' };
    }

    const sourceSummary = summarizeRecentConversation();
    const command = buildCustomCommandDefinition(slash, answers.purpose, sourceSummary);
    const saved = await entryCommandSyncService.saveCustomCommand(command, {
      scope: shouldSaveForTeam(answers.purpose || answers.notes || answers.commandName) ? 'team' : undefined,
    });
    if (saved.ok === false) {
      const text = `I could not save ${slash}: ${saved.reason}`;
      this.addMessage('model', text, 'save-command', options.source);
      useStore.getState().updateEntryCommandWorkflow({ status: 'blocked' });
      return { handled: true, responseText: text, agentId: 'save-command' };
    }

    useStore.getState().setEntryCommandWorkflow({
      ...getWorkflowState(),
      status: 'completed',
      missingFields: [],
      workflowExecutionId: saved.command.id,
      updatedAt: Date.now(),
    });

    const text = [
      `Saved ${saved.command.slash} as a reusable custom command.`,
      `Purpose: ${saved.command.summary}`,
      saved.command.harnessDomain ? `Harness domain: ${saved.command.harnessDomain}.` : 'Harness domain: custom conversation workflow.',
      `Intake: ${saved.command.intakeFields.map(field => field.label).join(', ')}.`,
      saved.command.approvalRequiredFor.length ? `Approval gates: ${saved.command.approvalRequiredFor.join(', ')}.` : '',
    ].filter(Boolean).join('\n\n');
    this.addMessage('model', text, saved.command.id, options.source, { customCommand: saved.command });
    return { handled: true, responseText: text, agentId: saved.command.id };
  }

  private extractAnswers(
    command: EntryCommandDefinition,
    text: string,
    preferredFields: string[] = []
  ): Record<string, string> {
    const clean = text.trim();
    if (!clean) return {};

    if (isContactCommand(command)) {
      return extractContactAnswers(clean);
    }
    if (isMerchCommand(command)) {
      return extractMerchAnswers(clean, preferredFields);
    }
    if (command.id === 'save-command') {
      return extractSaveCommandAnswers(clean, preferredFields);
    }

    const answers: Record<string, string> = {};
    const targetField = preferredFields[0] || command.intakeFields.find(field => field.required)?.id;
    if (targetField) answers[targetField] = clean;
    return answers;
  }

  private buildIntakeMessage(
    command: EntryCommandDefinition,
    answers: Record<string, string>,
    missingFields: string[]
  ): string {
    const answeredLabels = command.intakeFields
      .filter(field => answers[field.id])
      .map(field => `${field.label}: ${answers[field.id]}`);
    const nextFields: EntryCommandDefinition['intakeFields'] = (missingFields.length > 0
      ? missingFields
      : command.intakeFields.filter(field => !answers[field.id]).map(field => field.id)
    )
      .map(fieldId => command.intakeFields.find(field => field.id === fieldId))
      .filter((field): field is EntryCommandDefinition['intakeFields'][number] => Boolean(field));

    return [
      `Starting ${command.slash}: ${command.summary}`,
      answeredLabels.length ? `Captured:\n${answeredLabels.map(item => `- ${item}`).join('\n')}` : '',
      nextFields.length ? `Next:\n${nextFields.slice(0, 3).map(field => `- ${field.prompt}`).join('\n')}` : '',
      command.approvalRequiredFor.length ? `Approval gates: ${command.approvalRequiredFor.join(', ')}.` : '',
    ].filter(Boolean).join('\n\n');
  }

  private buildReadyMessage(command: EntryCommandDefinition, answers: Record<string, string>): string {
    const captured = Object.entries(answers)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join('\n');
    return [
      `${command.slash} intake is ready.`,
      captured,
      `Output contract: ${command.outputContract}`,
      command.workflowId ? `Mapped workflow: ${command.workflowId}.` : command.harnessDomain ? `Harness domain: ${command.harnessDomain}.` : '',
      command.approvalRequiredFor.length ? `No approval-gated action will run without confirmation: ${command.approvalRequiredFor.join(', ')}.` : '',
    ].filter(Boolean).join('\n\n');
  }

  private ensureChatSurface(source: EntryCommandSurface): void {
    const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;
    if (source === 'mobile' || isMobileViewport) {
      useStore.setState({ currentModule: 'agent' as import('@/core/constants').ModuleId });
      return;
    }
    useStore.setState({ isRightPanelOpen: true, rightPanelTab: 'agent', rightPanelView: 'messages' });
  }

  private addMessage(
    role: AgentMessage['role'],
    text: string,
    agentId?: string,
    source: EntryCommandSurface = 'command-bar',
    metadata?: Record<string, unknown>
  ): void {
    const message: AgentMessage = {
      id: uuidv4(),
      role,
      text,
      timestamp: Date.now(),
      source: source === 'mobile' ? 'mobile-remote' : 'desktop',
      ...(agentId ? { agentId } : {}),
      ...(metadata ? { metadata } : {}),
    };
    useStore.getState().addAgentMessage(message);
  }
}

function extractContactAnswers(text: string): Record<string, string> {
  const email = text.match(EMAIL_PATTERN)?.[0];
  const phone = text.match(PHONE_PATTERN)?.[0];
  const instagramMatch = text.match(INSTAGRAM_PATTERN);
  const instagram = instagramMatch ? `@${instagramMatch[1]}` : undefined;
  const scrubbed = text
    .replace(EMAIL_PATTERN, '')
    .replace(PHONE_PATTERN, '')
    .replace(INSTAGRAM_PATTERN, ' ')
    .replace(/\b(save name only|name only)\b/ig, '')
    .trim();
  const name = extractName(scrubbed);
  const answers: Record<string, string> = {};
  if (name) answers.name = name;
  if (email) answers.email = email;
  if (phone) answers.phone = phone;
  if (instagram) answers.instagram = instagram;
  answers.notes = text;
  if (/\bfan\b/i.test(text)) answers.role = 'fan';
  if (/\bvenue\b/i.test(text)) answers.role = 'venue_staff';
  if (/\bpromoter\b/i.test(text)) answers.role = 'promoter';
  if (/\bmanager\b/i.test(text)) answers.role = 'manager';
  if (/\bmedia|press|journalist\b/i.test(text)) answers.role = 'media';
  if (/\b(save name only|name only)\b/i.test(text)) answers.contactMethod = 'name-only';
  return answers;
}

function extractName(text: string): string {
  const explicit = text.match(/\b(?:this is|name is|met|meet|called)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  if (explicit?.[1]) return explicit[1].trim();
  const words = text
    .replace(/[,.;:]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return text.trim();
  const first = words[0]!;
  const second = words[1];
  if (second && /^[A-Z][a-z]+$/.test(first) && /^[A-Z][a-z]+$/.test(second)) {
    return `${first} ${second}`;
  }
  return first;
}

function extractMerchAnswers(text: string, preferredFields: string[]): Record<string, string> {
  const answers: Record<string, string> = {};
  if (/\bhoodie\b/i.test(text)) answers.productType = 'hoodie';
  else if (/\bposter\b/i.test(text)) answers.productType = 'poster';
  else if (/\bmug\b/i.test(text)) answers.productType = 'mug';
  else if (/\bshirt|t-shirt|tee\b/i.test(text)) answers.productType = 't-shirt';

  const provider = text.match(/\b(printful|printify|gooten|internal)\b/i)?.[1];
  if (provider) answers.provider = provider.toLowerCase();

  const money = text.match(MONEY_PATTERN)?.[1];
  if (money) answers.targetRetailPrice = money;

  const units = text.match(/\b(\d+)\s*(?:units|shirts|tees|pieces|qty|quantity)\b/i)?.[1];
  if (units) answers.expectedUnits = units;

  const fallbackField = preferredFields[0];
  if (fallbackField && !answers[fallbackField]) answers[fallbackField] = text;
  return answers;
}

function extractSaveCommandAnswers(text: string, preferredFields: string[] = []): Record<string, string> {
  const commandName = text.match(/(?:called|call it|named|name it|as)\s+(\/[a-zA-Z][a-zA-Z0-9-]*)/i)?.[1]
    || text.match(/(\/[a-zA-Z][a-zA-Z0-9-]*)/)?.[1];
  const answers: Record<string, string> = {};
  if (commandName) answers.commandName = commandName;

  const purpose = text
    .replace(/(?:turn|save|make|create|promote)\b/ig, '')
    .replace(/\b(?:that thing|what we just did|this|it|into|as|called|call it|named|name it|workflow|command|slash)\b/ig, '')
    .replace(/\/[a-zA-Z][a-zA-Z0-9-]*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (purpose) answers.purpose = purpose;

  const fallbackField = preferredFields[0];
  if (fallbackField && !answers[fallbackField]) answers[fallbackField] = text;
  return answers;
}

function isSaveCommandIntent(text: string): boolean {
  return /(?:turn|save|make|create|promote).*(?:workflow|command|slash)|(?:workflow|command).*(?:called|named|as)\s+\//i.test(text);
}

function shouldSaveForTeam(text = ''): boolean {
  return /\b(team|org|organization|workspace|everyone|shared)\b/i.test(text);
}

function buildCustomCommandDefinition(
  slash: string,
  purpose = '',
  sourceSummary = ''
): EntryCommandDefinition {
  const combinedContext = `${purpose}\n${sourceSummary}`;
  const harnessDomain = inferHarnessDomain(combinedContext);
  const title = slashToTitle(slash);
  const summary = buildCustomSummary(title, purpose, sourceSummary);

  return {
    id: `custom-${slash.slice(1)}`,
    slash,
    aliases: [],
    title,
    summary,
    surfaces: ['command-bar', 'mobile', 'voice'],
    ...(harnessDomain ? { harnessDomain } : {}),
    launchMode: 'guided-chat',
    intakeFields: inferCustomIntakeFields(harnessDomain),
    outputContract: inferCustomOutputContract(harnessDomain),
    approvalRequiredFor: inferCustomApprovalGates(harnessDomain),
    resumeBehavior: `Resume ${slash} with its saved conversation context and next missing workflow detail.`,
    isCustom: true,
    sourceSummary,
  };
}

function hasContactMethod(answers: Record<string, string>): boolean {
  return Boolean(answers.phone || answers.email || answers.instagram || answers.contactMethod === 'name-only');
}

function getWorkflowState() {
  return useStore.getState().entryCommandWorkflow || EMPTY_ENTRY_COMMAND_STATE;
}

function summarizeRecentConversation(): string {
  const state = useStore.getState() as {
    agentHistory?: AgentMessage[];
    boardroomMessages?: AgentMessage[];
  };
  const messages = [...(state.boardroomMessages || []), ...(state.agentHistory || [])]
    .filter(message => message.text?.trim())
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-12);
  const transcript = messages.map(message => `${message.role}: ${message.text.trim()}`).join('\n');
  return transcript.length > 1200 ? transcript.slice(-1200) : transcript;
}

function inferHarnessDomain(text: string): EntryCommandDefinition['harnessDomain'] {
  if (/\b(shirt|tee|hoodie|merch|pod|printful|printify|gooten|storefront|checkout)\b/i.test(text)) return 'merch_pod';
  if (/\b(contact|fan|email|sms|phone|instagram|crm|mailing list)\b/i.test(text)) return 'fan_crm';
  if (/\b(campaign|launch|ads?|content calendar|social post|marketing)\b/i.test(text)) return 'marketing_growth';
  if (/\b(release|distributor|metadata|isrc|upc|distribution)\b/i.test(text)) return 'release';
  if (/\b(contract|license|legal|agreement|clause)\b/i.test(text)) return 'legal_compliance';
  if (/\b(royalty|revenue|statement|earnings|payout)\b/i.test(text)) return 'royalty_revenue';
  if (/\b(cover|artwork|video|creative|visual|prompt)\b/i.test(text)) return 'creative_production';
  return undefined;
}

function inferCustomIntakeFields(harnessDomain: EntryCommandDefinition['harnessDomain']): EntryCommandDefinition['intakeFields'] {
  if (harnessDomain === 'merch_pod') {
    return [
      { id: 'productType', label: 'Product', prompt: 'What product are you selling?', required: true },
      { id: 'provider', label: 'POD provider', prompt: 'Which POD provider should I use: Printful, Printify, Gooten, or internal?', required: true },
      { id: 'targetRetailPrice', label: 'Retail price', prompt: 'What do you want to charge?', required: true },
      { id: 'expectedUnits', label: 'Units', prompt: 'How many units should I estimate?', required: true },
    ];
  }
  if (harnessDomain === 'fan_crm') {
    return [
      { id: 'name', label: 'Name', prompt: 'Who should I capture or update?', required: true },
      { id: 'contactMethod', label: 'Contact method', prompt: 'What phone, email, or Instagram should I attach?' },
    ];
  }
  if (harnessDomain === 'marketing_growth') {
    return [
      { id: 'goal', label: 'Goal', prompt: 'What is this campaign trying to make happen?', required: true },
      { id: 'release', label: 'Release or asset', prompt: 'Which release, event, or product is this for?' },
    ];
  }
  return [
    { id: 'request', label: 'Request', prompt: 'What should this saved workflow do this time?', required: true },
    { id: 'context', label: 'Context', prompt: 'What details changed since the original conversation?' },
  ];
}

function inferCustomOutputContract(harnessDomain: EntryCommandDefinition['harnessDomain']): string {
  if (harnessDomain === 'merch_pod') return 'Saved merch workflow with POD quote, provider readiness, margin estimate, and approval gates.';
  if (harnessDomain === 'fan_crm') return 'Saved CRM workflow with structured contact capture, source context, and approved follow-up eligibility.';
  if (harnessDomain === 'marketing_growth') return 'Saved campaign workflow with strategy, channel plan, content tasks, and send/post approval gates.';
  if (harnessDomain === 'release') return 'Saved release workflow with metadata readiness, QC gaps, and distribution approval gates.';
  return 'Saved conversation workflow with reusable intake, agent brief, recommendations, and approval gates where needed.';
}

function inferCustomApprovalGates(harnessDomain: EntryCommandDefinition['harnessDomain']): string[] {
  if (harnessDomain === 'merch_pod') return ['sample order', 'manufacturing order', 'storefront publish', 'paid checkout'];
  if (harnessDomain === 'fan_crm') return ['email send', 'SMS send', 'campaign enrollment'];
  if (harnessDomain === 'marketing_growth') return ['ad spend', 'email or SMS send', 'public posting'];
  if (harnessDomain === 'release') return ['distribution submission'];
  if (harnessDomain === 'legal_compliance') return ['attorney escalation', 'contract send or signature'];
  return ['paid action', 'public posting', 'outbound message'];
}

function buildCustomSummary(title: string, purpose: string, sourceSummary: string): string {
  const base = purpose || sourceSummary || `Repeat the saved ${title} conversation workflow.`;
  const compact = base.replace(/\s+/g, ' ').trim();
  return compact.length > 140 ? `${compact.slice(0, 137)}...` : compact;
}

function slashToTitle(slash: string): string {
  return slash
    .replace(/^\//, '')
    .split('-')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Custom Command';
}

function isMerchCommand(command: EntryCommandDefinition): boolean {
  return command.id === 'tour-merch' || command.harnessDomain === 'merch_pod';
}

function isContactCommand(command: EntryCommandDefinition): boolean {
  return command.id === 'capture-contact' || command.harnessDomain === 'fan_crm';
}

function buildContactNotes(answers: Record<string, string>): string {
  const notes = answers.notes || '';
  const consent = 'Captured from direct field interaction. Email/SMS follow-up requires separate approval.';
  return notes ? `${notes}\n\n${consent}` : consent;
}

function normalizeRole(input = ''): FieldContactRole {
  if (/\bfan\b/i.test(input)) return 'fan';
  if (/\bvenue\b/i.test(input)) return 'venue_staff';
  if (/\bengineer\b/i.test(input)) return 'engineer';
  if (/\bpromoter\b/i.test(input)) return 'promoter';
  if (/\bmanager\b/i.test(input)) return 'manager';
  if (/\bmedia|press|journalist\b/i.test(input)) return 'media';
  if (/\bmusician|artist|dj|producer\b/i.test(input)) return 'musician';
  return 'other';
}

function normalizeProvider(provider = ''): 'printful' | 'printify' | 'gooten' | 'internal' {
  const normalized = provider.toLowerCase();
  if (normalized === 'printify' || normalized === 'gooten' || normalized === 'internal') return normalized;
  return 'printful';
}

function parseMoney(value?: string): number | null {
  if (!value) return null;
  const match = value.match(MONEY_PATTERN);
  return match?.[1] ? Number(match[1]) : null;
}

function parseInteger(value?: string): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function estimateBaseCost(productType = ''): number {
  if (/hoodie/i.test(productType)) return 24;
  if (/poster/i.test(productType)) return 8;
  if (/mug/i.test(productType)) return 10;
  return 14;
}

export const entryCommandService = new EntryCommandService();
