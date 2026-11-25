import { describe, it, expect, vi, beforeEach } from 'vitest';
import { agentFirebaseConnector } from '../AgentFirebaseConnector';
import type { AgentMessage } from '@/core/store/slices/agent/agentSessionSlice';
import { setDoc, doc } from 'firebase/firestore';

describe('AgentFirebaseConnector deprecation (ISSUE-1674)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('performs zero Firestore writes to deprecated boardroom_messages on syncMessage', async () => {
        const mockMsg: AgentMessage = {
            id: 'msg-abc-123',
            role: 'model',
            text: 'Session-scoped message persistence now handles writes.',
            timestamp: 1716240000000,
            isStreaming: false,
            agentId: 'generalist',
        };

        await expect(agentFirebaseConnector.syncMessage(mockMsg)).resolves.toBeUndefined();
        expect(doc).not.toHaveBeenCalled();
        expect(setDoc).not.toHaveBeenCalled();
    });
});
