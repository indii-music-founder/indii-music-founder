import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearCustomEntryCommands,
  ENTRY_COMMANDS,
  getDashboardEntryCommands,
  getRequiredMissingFields,
  saveCustomEntryCommand,
  resolveEntryCommand,
} from './EntryCommandRegistry';
import { WORKFLOW_REGISTRY } from '@/services/agent/WorkflowRegistry';
import { BUSINESS_HARNESS_CATALOG } from '@/services/business-harness/HarnessCatalog';

describe('EntryCommandRegistry', () => {
  beforeEach(() => {
    clearCustomEntryCommands();
  });

  it('keeps command ids and slash aliases unique', () => {
    const ids = new Set<string>();
    const slashes = new Set<string>();

    for (const command of ENTRY_COMMANDS) {
      expect(ids.has(command.id)).toBe(false);
      ids.add(command.id);

      for (const slash of [command.slash, ...command.aliases]) {
        expect(slashes.has(slash)).toBe(false);
        slashes.add(slash);
        expect(slash.startsWith('/')).toBe(true);
      }
    }
  });

  it('maps commands only to valid workflows and harness domains', () => {
    const domains = new Set(BUSINESS_HARNESS_CATALOG.map(entry => entry.domain));

    for (const command of ENTRY_COMMANDS) {
      if (command.workflowId) {
        expect(WORKFLOW_REGISTRY[command.workflowId]).toBeTruthy();
      }
      if (command.harnessDomain) {
        expect(domains.has(command.harnessDomain)).toBe(true);
      }
    }
  });

  it('resolves aliases from typed slash commands', () => {
    expect(resolveEntryCommand('/cover neon street'))?.toMatchObject({ id: 'design-cover' });
    expect(resolveEntryCommand('/met-someone Marcus 313-555-0123'))?.toMatchObject({ id: 'capture-contact' });
    expect(resolveEntryCommand('normal chat')).toBeUndefined();
  });

  it('exposes dashboard commands without losing custom workflow', () => {
    const ids = getDashboardEntryCommands().map(command => command.id);
    expect(ids).toContain('design-cover');
    expect(ids).toContain('custom-workflow');
  });

  it('detects required missing fields from intake answers', () => {
    const command = resolveEntryCommand('/tour-merch')!;
    expect(getRequiredMissingFields(command, { productType: 't-shirt' })).toEqual([
      'provider',
      'targetRetailPrice',
      'expectedUnits',
    ]);
  });

  it('saves and resolves custom commands without overriding built-ins', () => {
    const saved = saveCustomEntryCommand({
      id: 'custom-shirt',
      slash: '/shirt',
      aliases: [],
      title: 'Shirt',
      summary: 'Tour shirt checkout workflow.',
      surfaces: ['command-bar', 'mobile', 'voice'],
      harnessDomain: 'merch_pod',
      launchMode: 'guided-chat',
      intakeFields: [
        { id: 'productType', label: 'Product', prompt: 'What product?', required: true },
      ],
      outputContract: 'Custom merch workflow.',
      approvalRequiredFor: ['paid checkout'],
      resumeBehavior: 'Resume the shirt workflow.',
      isCustom: true,
    });

    expect(saved.ok).toBe(true);
    expect(resolveEntryCommand('/shirt now'))?.toMatchObject({ id: 'custom-shirt', isCustom: true });

    const reserved = saveCustomEntryCommand({
      id: 'custom-cover',
      slash: '/my-cover',
      aliases: ['/design-cover'],
      title: 'Cover Override',
      summary: 'Should not save.',
      surfaces: ['command-bar'],
      launchMode: 'guided-chat',
      intakeFields: [],
      outputContract: 'Invalid override.',
      approvalRequiredFor: [],
      resumeBehavior: 'Invalid.',
      isCustom: true,
    });
    expect(reserved.ok).toBe(false);

    const reservedPrimary = saveCustomEntryCommand({
      id: 'custom-cover-primary',
      slash: '/design-cover',
      aliases: [],
      title: 'Cover Override',
      summary: 'Should not save.',
      surfaces: ['command-bar'],
      launchMode: 'guided-chat',
      intakeFields: [],
      outputContract: 'Invalid override.',
      approvalRequiredFor: [],
      resumeBehavior: 'Invalid.',
      isCustom: true,
    });
    expect(reservedPrimary.ok).toBe(false);
  });
});
