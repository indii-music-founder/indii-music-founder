import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { agentFirebaseConnector } from '../AgentFirebaseConnector';
import { AgentMessage } from '@/core/store/slices/agent/agentSessionSlice';
import { setDoc, doc } from 'firebase/firestore';
import { auth } from '@/services/firebase';

// Mock auth current user specifically for our test module
vi.mock('@/services/firebase', async (importOriginal) => {
    const actual = await importOriginal() as any;
    return {
        ...actual,
        auth: {
            currentUser: { uid: 'test-user-123' }
        }
    };
});

describe('AgentFirebaseConnector Integration Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Clear mock flags
        if (typeof window !== 'undefined') {
            delete (window as any).FIREBASE_E2E_MOCK;
        }
        localStorage.removeItem('FIREBASE_E2E_MOCK');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should map AgentMessage to BoardroomMessageDocument and save to Firestore', async () => {
        const mockMsg: AgentMessage = {
            id: 'msg-abc-123',
            role: 'model',
            text: 'Hello from Generalist Agent!',
            timestamp: 1716240000000, // May 2026
            isStreaming: false,
            agentId: 'generalist',
            thoughtSignature: 'sig-123',
            source: 'desktop',
            metadata: { ip: '127.0.0.1' },
            planId: 'plan-xyz',
            thoughts: [
                {
                    id: 'thought-1',
                    text: 'Analyzing codebase structure...',
                    timestamp: 1716240000010,
                    type: 'logic'
                }
            ]
        };

        await agentFirebaseConnector.syncMessage(mockMsg);

        // Assert that doc() was called with correct collection path and ID
        expect(doc).toHaveBeenCalledWith(expect.any(Object), 'boardroom_messages', 'msg-abc-123');

        // Assert that setDoc was called with correctly mapped document
        expect(setDoc).toHaveBeenCalled();
        const callArgs = vi.mocked(setDoc).mock.calls[0];
        expect(callArgs).toBeDefined();
        
        // DocRef is the first argument, the second is data
        const savedData = callArgs![1] as any;
        expect(savedData.id).toBe('msg-abc-123');
        expect(savedData.role).toBe('model');
        expect(savedData.text).toBe('Hello from Generalist Agent!');
        expect(savedData.agentId).toBe('generalist');
        expect(savedData.thoughtSignature).toBe('sig-123');
        expect(savedData.source).toBe('desktop');
        expect(savedData.planId).toBe('plan-xyz');
        expect(savedData.userId).toBe('test-user-123');
        expect(savedData.isStreaming).toBe(false);
        
        // Timestamps should be Firestore Timestamps
        expect(savedData.timestamp).toBeDefined();
        expect(savedData.timestamp.toMillis()).toBe(1716240000000);
        
        // Thoughts should be mapped
        expect(savedData.thoughts).toHaveLength(1);
        expect(savedData.thoughts[0].id).toBe('thought-1');
        expect(savedData.thoughts[0].text).toBe('Analyzing codebase structure...');
        expect(savedData.thoughts[0].timestamp.toMillis()).toBe(1716240000010);
        expect(savedData.thoughts[0].type).toBe('logic');
    });

    it('should prune undefined values during serialization', async () => {
        const mockMsg: AgentMessage = {
            id: 'msg-prune-456',
            role: 'user',
            text: 'Pruning check',
            timestamp: Date.now(),
            agentId: undefined, // should be pruned
            thoughtSignature: undefined, // should be pruned
            source: undefined, // should be pruned
            metadata: undefined // should be pruned
        };

        await agentFirebaseConnector.syncMessage(mockMsg);

        expect(setDoc).toHaveBeenCalled();
        const callArgs = vi.mocked(setDoc).mock.calls[0];
        expect(callArgs).toBeDefined();
        const savedData = callArgs![1] as any;

        expect(savedData.agentId).toBeUndefined();
        expect(savedData.thoughtSignature).toBeUndefined();
        expect(savedData.source).toBeUndefined();
        expect(savedData.metadata).toBeUndefined();
    });

    it('should fail closed if auth is not available', async () => {
        // Temp override currentUser
        const originalCurrentUser = auth.currentUser;
        Object.defineProperty(auth, 'currentUser', {
            get: () => null,
            configurable: true
        });

        const mockMsg: AgentMessage = {
            id: 'msg-anon-789',
            role: 'system',
            text: 'System offline warning',
            timestamp: Date.now()
        };

        await expect(agentFirebaseConnector.syncMessage(mockMsg)).rejects.toThrow('User must be authenticated');
        expect(setDoc).not.toHaveBeenCalled();

        // Restore
        Object.defineProperty(auth, 'currentUser', {
            get: () => originalCurrentUser,
            configurable: true
        });
    });

    it('should handle E2E bypass correctly', async () => {
        // Enable E2E bypass mock
        localStorage.setItem('FIREBASE_E2E_MOCK', 'true');

        const mockMsg: AgentMessage = {
            id: 'msg-bypass-101',
            role: 'user',
            text: 'Should bypass write',
            timestamp: Date.now()
        };

        await agentFirebaseConnector.syncMessage(mockMsg);

        // setDoc should not be called due to bypass
        expect(setDoc).not.toHaveBeenCalled();
    });
});
