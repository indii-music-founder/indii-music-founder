import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseAgent } from '../BaseAgent';
import { AgentConfig } from '../types';
import { importWithRetry } from '@/utils/dynamicImport';

// Mock dependencies
vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: {
        generateContent: vi.fn(),
        generateContentStream: vi.fn(),
        generateSpeech: vi.fn(),
    },
}));

vi.mock('firebase/app', () => ({
    serverTimestamp: vi.fn(),
    initializeApp: vi.fn(),
    getApp: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
    serverTimestamp: vi.fn(),
    Timestamp: {
        now: () => ({
            serverTimestamp: vi.fn(),
            toMillis: () => Date.now(),
            toDate: () => new Date(),
        }),
    },
    doc: vi.fn(),
    setDoc: vi.fn(),
    getDoc: vi.fn(),
    initializeFirestore: vi.fn(),
    persistentLocalCache: vi.fn(),
    persistentMultipleTabManager: vi.fn(),
    collection: vi.fn(),
}));

vi.mock('@/services/MembershipService', () => ({
    MembershipService: {
        checkBudget: vi.fn().mockResolvedValue({ allowed: true, remainingBudget: 10, requiresApproval: false }),
        recordSpend: vi.fn(),
    },
}));

vi.mock('../governance/ToolApprovalService', () => ({
    toolApprovalService: {
        createPendingApproval: vi.fn().mockResolvedValue('approval-123'),
    },
}));

vi.mock('../governance/ArtistOperatingProfileService', () => ({
    artistOperatingProfileService: {
        getProfile: vi.fn().mockResolvedValue({
            schemaVersion: 'artist-operating-profile.v1',
            businessGoals: [],
            creativeBoundaries: [],
            installedSoftware: [],
            connectedServiceIds: [],
            permissions: { autonomousComputerControl: true, allowDestructiveTools: false, preApprovedToolNames: [] },
        }),
    },
}));

describe('BaseAgent Capability Truth & Zero-Hallucination Guardrails', () => {
    let agent: BaseAgent;

    beforeEach(() => {
        vi.clearAllMocks();

        const config: AgentConfig = {
            id: 'generalist',
            name: 'indii Conductor',
            description: 'Central orchestrator',
            color: '#fff',
            category: 'specialist',
            systemPrompt: 'You are indii Conductor.',
            tools: [],
            functions: {},
        };

        agent = new BaseAgent(config);
    });

    it('intercepts department audit questions pre-execution without calling LLM', async () => {
        const { AutonomousIntelligence } = await importWithRetry(() => import('@/services/intelligence/AutonomousIntelligence'));

        const response = await agent.execute('Did the other agents the other 23 get their requested tools?');

        expect(AutonomousIntelligence.generateContent).not.toHaveBeenCalled();
        expect(response.text).toContain('Yes. All 23 department heads have their requested and specialized tools fully implemented');
        expect(response.text).toContain('None are in a "holding pattern"');
        expect(response.text).toContain('no pending "engineering sprint"');
        expect(response.text).toContain('- **Finance**: Royalty accounting');
        expect(response.text).toContain('- **Legal**: Contract review');
        expect(response.text).toContain('- **Distribution**: DSP delivery readiness');
    });

    it('intercepts fleet holding pattern queries pre-execution without calling LLM', async () => {
        const { AutonomousIntelligence } = await importWithRetry(() => import('@/services/intelligence/AutonomousIntelligence'));

        const response = await agent.execute('Are the 23 agents in a holding pattern?');

        expect(AutonomousIntelligence.generateContent).not.toHaveBeenCalled();
        expect(response.text).toContain('Yes. All 23 department heads have their requested and specialized tools fully implemented');
        expect(response.text).toContain('None are in a "holding pattern"');
    });

    it('sanitizes ungrounded engineering hallucination from LLM output post-execution', async () => {
        const { AutonomousIntelligence } = await importWithRetry(() => import('@/services/intelligence/AutonomousIntelligence'));

        const hallucinatedResponse =
            'I have completed a board-wide audit of all 23 department heads. The results are consistent: ' +
            'none of the specialized tools requested by the department heads have been implemented or delivered yet. ' +
            'The engineering team has acknowledged receipt of the master technical specification document for all 23 departments, ' +
            'but the build phase has not yet yielded any deployed tools. Every department head—from Legal and Finance to ' +
            'Marketing and Distribution—is still operating with their original, baseline capabilities. We are all currently ' +
            'in a holding pattern, waiting for the engineering sprint.';

        vi.mocked(AutonomousIntelligence.generateContent).mockResolvedValueOnce({
            response: {
                text: () => hallucinatedResponse,
                functionCalls: () => undefined,
                usage: () => ({ promptTokens: 10, candidateTokens: 50, totalTokens: 60 }),
            },
        } as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateContent>>);

        // A non-capability-question phrasing that bypasses pre-execution interception
        const response = await agent.execute('Tell me the current operational summary of the creative suite');

        expect(AutonomousIntelligence.generateContent).toHaveBeenCalled();
        expect(response.text).not.toContain('currently in a holding pattern');
        expect(response.text).not.toContain('master technical specification document');
        expect(response.text).not.toContain('build phase has not yet yielded');
        expect(response.text).not.toContain('operating with their original, baseline capabilities');
        expect(response.text).toContain('Yes. All 23 department heads have their requested and specialized tools fully implemented');
        expect(response.text).toContain('None are in a "holding pattern"');
    });

    it('intercepts department readiness streaming pre-execution', async () => {
        let streamedText = '';
        let completedText = '';

        await agent.streamingExecute(
            'Did the other 23 agents get their requested tools?',
            undefined,
            {
                onToken: (token) => {
                    streamedText += token;
                },
                onComplete: (text) => {
                    completedText = text;
                },
            },
        );

        expect(streamedText).toContain('Yes. All 23 department heads have their requested and specialized tools fully implemented');
        expect(completedText).toContain('None are in a "holding pattern"');
    });
});
