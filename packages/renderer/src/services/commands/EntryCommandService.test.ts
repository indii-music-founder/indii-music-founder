import { beforeEach, describe, expect, it, vi } from 'vitest';

const storeState = vi.hoisted(() => ({
  entryCommandWorkflow: {
    activeCommandId: null as string | null,
    status: 'idle',
    answers: {} as Record<string, string>,
    missingFields: [] as string[],
    workflowExecutionId: null as string | null,
    harnessRunId: null as string | null,
    source: null as string | null,
    startedAt: null as number | null,
    updatedAt: null as number | null,
  },
  currentProjectId: 'project-1',
  agentHistory: [] as Array<{ id: string; role: 'user' | 'model' | 'system'; text: string; timestamp: number }>,
  boardroomMessages: [] as Array<{ id: string; role: 'user' | 'model' | 'system'; text: string; timestamp: number }>,
  addAgentMessage: vi.fn(),
  setEntryCommandWorkflow: vi.fn((workflow) => {
    storeState.entryCommandWorkflow = workflow;
  }),
  updateEntryCommandWorkflow: vi.fn((updates) => {
    storeState.entryCommandWorkflow = {
      ...storeState.entryCommandWorkflow,
      ...updates,
      updatedAt: Date.now(),
    };
  }),
  clearEntryCommandWorkflow: vi.fn(),
  setModule: vi.fn(),
}));

vi.mock('@/core/store', () => ({
  useStore: Object.assign(
    (selector: any) => selector(storeState),
    {
      getState: () => storeState,
      setState: (partial: any) => Object.assign(storeState, typeof partial === 'function' ? partial(storeState) : partial),
    }
  ),
}));

vi.mock('@/services/firebase', () => ({
  auth: { currentUser: { uid: 'user-1' } },
}));

vi.mock('@/services/contacts/FieldContactService', () => ({
  FieldContactService: {
    getCurrentLocation: vi.fn().mockResolvedValue(null),
    buildContextString: vi.fn(() => 'Jun 6, 2026 - 2:00 PM'),
    addFieldContact: vi.fn().mockResolvedValue('contact-1'),
  },
}));

vi.mock('@/services/business-harness/MerchPodHarnessService', () => ({
  merchPodHarnessService: {
    compile: vi.fn(() => ({
      runId: 'harness-1',
      output: {
        recommendations: [{
          productType: 't-shirt',
          provider: 'printful',
          retailPrice: 30,
          landedCost: 20,
          grossMargin: 0.33,
        }],
      },
    })),
  },
}));

vi.mock('./EntryCommandSyncService', async () => {
  const registry = await vi.importActual<typeof import('./EntryCommandRegistry')>('./EntryCommandRegistry');
  return {
    entryCommandSyncService: {
      hydrateCustomCommands: vi.fn(async () => registry.getCustomEntryCommands()),
      saveCustomCommand: vi.fn(async (command) => registry.saveCustomEntryCommand(command)),
    },
  };
});

import { entryCommandService } from './EntryCommandService';
import { clearCustomEntryCommands, resolveEntryCommand } from './EntryCommandRegistry';
import { entryCommandSyncService } from './EntryCommandSyncService';
import { FieldContactService } from '@/services/contacts/FieldContactService';
import { merchPodHarnessService } from '@/services/business-harness/MerchPodHarnessService';

describe('EntryCommandService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCustomEntryCommands();
    storeState.agentHistory = [];
    storeState.boardroomMessages = [];
    storeState.entryCommandWorkflow = {
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
  });

  it('passes through normal chat when no workflow is active', async () => {
    const result = await entryCommandService.handleInput('hello indii', {
      source: 'command-bar',
      includeUserMessage: true,
    });

    expect(result.handled).toBe(false);
    expect(storeState.addAgentMessage).not.toHaveBeenCalled();
  });

  it('captures a field contact from messy slash input', async () => {
    const result = await entryCommandService.handleInput('/capture-contact Marcus 313-555-0123 met at merch table', {
      source: 'mobile',
      includeUserMessage: true,
    });

    expect(result.handled).toBe(true);
    expect(FieldContactService.addFieldContact).toHaveBeenCalledWith('user-1', expect.objectContaining({
      name: 'Marcus',
      phone: '313-555-0123',
      source: 'quick_capture',
    }));
    expect(storeState.entryCommandWorkflow.status).toBe('completed');
    expect(result.responseText).toContain('Saved');
  });

  it('asks for contact method when only a name is available', async () => {
    const result = await entryCommandService.handleInput('/capture-contact Marcus', {
      source: 'command-bar',
      includeUserMessage: true,
    });

    expect(result.handled).toBe(true);
    expect(FieldContactService.addFieldContact).not.toHaveBeenCalled();
    expect(storeState.entryCommandWorkflow.status).toBe('collecting');
    expect(result.responseText).toContain('Next');
  });

  it('compiles tour merch quote without executing paid actions', async () => {
    const result = await entryCommandService.handleInput('/tour-merch t-shirt printful $30 50 units', {
      source: 'command-bar',
      includeUserMessage: true,
    });

    expect(result.handled).toBe(true);
    expect(merchPodHarnessService.compile).toHaveBeenCalled();
    expect(result.responseText).toContain('I will not execute any paid or public action without approval');
    expect(storeState.entryCommandWorkflow.status).toBe('completed');
  });

  it('promotes recent boardroom context into a reusable custom command', async () => {
    storeState.boardroomMessages = [
      {
        id: 'board-1',
        role: 'model',
        text: 'We built a tour shirt process using Printful, margin checks, sample approval, and checkout approval.',
        timestamp: 100,
      },
    ];

    const result = await entryCommandService.handleInput('turn what we just did into a workflow command called /shirt', {
      source: 'command-bar',
      includeUserMessage: true,
    });

    expect(result.handled).toBe(true);
    expect(result.responseText).toContain('Saved /shirt');
    expect(entryCommandSyncService.saveCustomCommand).toHaveBeenCalled();
    expect(resolveEntryCommand('/shirt'))?.toMatchObject({
      id: 'custom-shirt',
      harnessDomain: 'merch_pod',
      isCustom: true,
    });
    expect(storeState.entryCommandWorkflow.status).toBe('completed');
  });

  it('runs saved merch custom commands through the approval-gated merch path', async () => {
    await entryCommandService.handleInput('turn our t-shirt checkout workflow into a command called /shirt', {
      source: 'command-bar',
      includeUserMessage: true,
    });

    const result = await entryCommandService.handleInput('/shirt t-shirt printful $30 50 units', {
      source: 'command-bar',
      includeUserMessage: true,
    });

    expect(result.handled).toBe(true);
    expect(merchPodHarnessService.compile).toHaveBeenCalled();
    expect(result.responseText).toContain('I will not execute any paid or public action without approval');
  });
});
