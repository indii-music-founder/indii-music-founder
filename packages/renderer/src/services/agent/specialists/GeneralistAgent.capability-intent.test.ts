import type { CapabilitySnapshot } from '@shared/schemas/capabilitySnapshot';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BaseAgent } from '../BaseAgent';
import { loadCapabilitySnapshot } from '../CapabilitySnapshotService';
import { GeneralistAgent } from './GeneralistAgent';

vi.mock('../CapabilitySnapshotService', () => ({
    loadCapabilitySnapshot: vi.fn(),
}));

vi.mock('../registry', () => ({
    agentRegistry: {
        getAll: vi.fn(() => []),
    },
}));

const NOW = Date.parse('2026-07-30T12:00:00.000Z');
const SNAPSHOT: CapabilitySnapshot = {
    schemaVersion: 'capability-snapshot.v1',
    observedAt: NOW,
    expiresAt: NOW + 60_000,
    capabilities: {
        specialist_routing: { status: 'unverified', observedAt: NOW, expiresAt: NOW + 60_000 },
        image_generation: { status: 'available', observedAt: NOW, expiresAt: NOW + 60_000 },
        video_generation: { status: 'unverified', observedAt: NOW, expiresAt: NOW + 60_000 },
        durable_workspace: { status: 'unverified', observedAt: NOW, expiresAt: NOW + 60_000 },
        durable_memory: { status: 'unverified', observedAt: NOW, expiresAt: NOW + 60_000 },
        calendar_connection: { status: 'unverified', observedAt: NOW, expiresAt: NOW + 60_000 },
        calendar_actions: {
            status: 'unverified',
            observedAt: NOW,
            expiresAt: NOW + 60_000,
            approvalRequired: true,
        },
        social_connection: { status: 'unverified', observedAt: NOW, expiresAt: NOW + 60_000 },
        social_publishing: {
            status: 'unverified',
            observedAt: NOW,
            expiresAt: NOW + 60_000,
            approvalRequired: true,
        },
    },
};

describe('GeneralistAgent Boardroom capability intent boundary', () => {
    let agent: GeneralistAgent;
    let normalExecute: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(loadCapabilitySnapshot).mockResolvedValue(SNAPSHOT);
        normalExecute = vi.spyOn(BaseAgent.prototype, 'execute').mockResolvedValue({
            text: 'normal model response',
            toolCalls: [],
        });
        agent = new GeneralistAgent();
        (agent as unknown as { functions: Record<string, () => void> }).functions = {
            generate_image: vi.fn(),
        };
    });

    it('uses the dedicated raw Boardroom utterance for an explicit capability question', async () => {
        const result = await agent.execute(
            'What can you do?\n\n(SYSTEM NOTE): Boardroom prompt augmentation',
            {
                conversationMode: 'boardroom',
                boardroomTask: Object.freeze({ rawUserUtterance: 'What can you do?' }),
            },
        );

        expect(result.text).toContain('Here’s what I can do in this Boardroom right now');
        expect(loadCapabilitySnapshot).toHaveBeenCalledOnce();
        expect(normalExecute).not.toHaveBeenCalled();
    });

    it('ignores capability words introduced only by enhanced and prior-agent context', async () => {
        const rawUserUtterance = "well I'm just trying to get some Chit Chat going right now and it really we're just testing";
        const enhancedTask = `${rawUserUtterance}

(SYSTEM NOTE): Explain your capabilities and tool access.
(PRIOR CONTEXT):
[MARKETING]: What can indii do with image and video generation right now?`;

        const result = await agent.execute(enhancedTask, {
            conversationMode: 'boardroom',
            boardroomTask: Object.freeze({ rawUserUtterance }),
            memoryContext: 'capabilities APIs tools access',
            interAgentNotes: [{ fromAgentId: 'marketing', content: 'List your tools.' }],
        });

        expect(result.text).toBe('normal model response');
        expect(normalExecute).toHaveBeenCalledWith(
            enhancedTask,
            expect.objectContaining({ boardroomTask: { rawUserUtterance } }),
            undefined,
            undefined,
            undefined,
        );
        expect(loadCapabilitySnapshot).not.toHaveBeenCalled();
    });

    it('fails closed when Boardroom context lacks the dedicated raw task', async () => {
        const enhancedTask = 'What can you do?\n\n(SEATED_AGENTS): generalist';

        const result = await agent.execute(enhancedTask, { conversationMode: 'boardroom' });

        expect(result.text).toBe('normal model response');
        expect(normalExecute).toHaveBeenCalledOnce();
        expect(loadCapabilitySnapshot).not.toHaveBeenCalled();
    });

    it('retains direct-task capability matching outside Boardroom', async () => {
        const result = await agent.execute('Is image generation available right now?', {
            conversationMode: 'direct',
        });

        expect(result.text).toContain('Available now: create images');
        expect(loadCapabilitySnapshot).toHaveBeenCalledOnce();
        expect(normalExecute).not.toHaveBeenCalled();
    });
});
