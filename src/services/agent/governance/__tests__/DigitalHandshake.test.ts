import { expect, test, describe, vi, beforeEach } from 'vitest';
import { DigitalHandshake } from '../DigitalHandshake';
import { Directive } from '../../../directive/DirectiveTypes';
import { Timestamp } from 'firebase/firestore';
import { DirectiveService } from '../../../directive/DirectiveService';

// Mock internal firebase imports
vi.mock('../../../../firebase', () => ({
    db: {}
}));
vi.mock('firebase/firestore', async (importOriginal) => {
    const actual = await importOriginal<typeof import('firebase/firestore')>();
    return {
        ...actual,
        collection: vi.fn(),
        addDoc: vi.fn().mockResolvedValue({ id: 'mock-doc-id' }),
        Timestamp: {
            now: vi.fn().mockReturnValue(new Date())
        }
    };
});

// Mock DirectiveService
vi.mock('../../../directive/DirectiveService', () => ({
    DirectiveService: {
        updateStatus: vi.fn().mockResolvedValue(undefined)
    }
}));

describe('DigitalHandshake', () => {
    const baseDirective: Directive = {
        id: 'test-doc',
        userId: 'user_123',
        title: 'Test',
        status: 'IN_PROGRESS',
        assignedAgent: 'indiiOD',
        goalAncestry: 'xyz',
        computeAllocation: {
            maxTokens: 1000,
            tokensUsed: 500,
            isMaximizerModeActive: false
        },
        contextFiles: [],
        conversationThread: [],
        requiresDigitalHandshake: false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('should allow execution if budget not exceeded and non-destructive', async () => {
        const result = await DigitalHandshake.require(baseDirective, 'Safe Action', false);
        expect(result).toBe(true);
    });

    test('should pause execution if budget exceeded', async () => {
        const exceededDirective = {
            ...baseDirective,
            computeAllocation: {
                ...baseDirective.computeAllocation,
                tokensUsed: 1500
            }
        };

        const result = await DigitalHandshake.require(exceededDirective, 'Budget exceeded Action', false);
        expect(result).toBe(false);
        expect(DirectiveService.updateStatus).toHaveBeenCalledWith('user_123', 'test-doc', 'WAITING_ON_HANDSHAKE');
    });

    test('should allow execution if budget exceeded BUT maximizer mode active', async () => {
        const maximizerDirective = {
            ...baseDirective,
            computeAllocation: {
                ...baseDirective.computeAllocation,
                tokensUsed: 1500,
                isMaximizerModeActive: true
            }
        };

        const result = await DigitalHandshake.require(maximizerDirective, 'Maximized Action', false);
        expect(result).toBe(true);
    });

    test('should pause execution if destructive action regardless of budget', async () => {
        const result = await DigitalHandshake.require(baseDirective, 'Destructive Action', true);
        expect(result).toBe(false);
        expect(DirectiveService.updateStatus).toHaveBeenCalledWith('user_123', 'test-doc', 'WAITING_ON_HANDSHAKE');
    });
});
