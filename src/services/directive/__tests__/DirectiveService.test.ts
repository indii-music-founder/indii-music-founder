import { expect, test, describe, vi, beforeEach } from 'vitest';
import { DirectiveService } from '../DirectiveService';
import { Timestamp } from 'firebase/firestore';

// Mock implementation of FirestoreService
vi.mock('../../FirestoreService', () => {
    return {
        FirestoreService: class {
            add = vi.fn().mockResolvedValue('test-directive-id');
            get = vi.fn().mockResolvedValue({ id: 'test-directive-id', status: 'IN_PROGRESS' });
            update = vi.fn().mockResolvedValue(undefined);
            list = vi.fn().mockResolvedValue([
                { id: 'test-directive-id', assignedAgent: 'indiiOD', status: 'OPEN' }
            ]);
        }
    };
});

describe('DirectiveService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('should create a directive correctly', async () => {
        const result = await DirectiveService.create('user_123', {
            title: 'Test Directive',
            status: 'OPEN',
            assignedAgent: 'indiiOD',
            goalAncestry: 'indii asked to test',
            computeAllocation: {
                maxTokens: 1000,
                tokensUsed: 0,
                isMaximizerModeActive: false
            },
            contextFiles: [],
            requiresDigitalHandshake: false
        });

        expect(result.id).toBe('test-directive-id');
        expect(result.userId).toBe('user_123');
        expect(result.status).toBe('OPEN');
        expect(result.createdAt).toBeDefined();
    });

    test('should fetch active directives for agent', async () => {
        const result = await DirectiveService.getActiveDirectivesForAgent('user_123', 'indiiOD');
        expect(result.length).toBe(1);
        expect(result[0]!.assignedAgent).toBe('indiiOD');
    });
});
