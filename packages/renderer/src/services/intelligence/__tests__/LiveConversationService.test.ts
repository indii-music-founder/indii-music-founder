import { describe, it, expect, vi, beforeEach } from 'vitest';
import { liveConversationService } from '../LiveConversationService';
import { voiceService } from '@/services/intelligence/VoiceService';

vi.mock('@/services/intelligence/VoiceService', () => ({
    voiceService: {
        isSupported: vi.fn(() => true),
        startDictation: vi.fn(() => true),
        stopDictation: vi.fn(),
        stopDictationIfOwner: vi.fn(),
        speak: vi.fn().mockResolvedValue(undefined),
        stopSpeaking: vi.fn(),
    },
}));

const mockSetLiveActive = vi.fn();
const mockSetLivePhase = vi.fn();
const mockSetActiveSpeakingAgentId = vi.fn();
const mockSetCommandBarInput = vi.fn();

vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({
            isLiveConversationActive: false,
            liveConversationPhase: 'idle',
            activeSpeakingAgentId: null,
            agentVoiceOverrides: {},
            setLiveConversationActive: mockSetLiveActive,
            setLiveConversationPhase: mockSetLivePhase,
            setActiveSpeakingAgentId: mockSetActiveSpeakingAgentId,
            setCommandBarInput: mockSetCommandBarInput,
            commandBarAttachments: [],
            setCommandBarAttachments: vi.fn(),
            currentModule: 'dashboard',
            chatChannel: 'indii',
        }),
    },
}));

describe('LiveConversationService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('starts a live conversation session successfully', async () => {
        const started = await liveConversationService.startSession();
        expect(started).toBe(true);
        expect(liveConversationService.isActive()).toBe(true);
        expect(mockSetLiveActive).toHaveBeenCalledWith(true);
        expect(mockSetLivePhase).toHaveBeenCalledWith('listening');
        expect(voiceService.startDictation).toHaveBeenCalled();
    });

    it('stops an active session cleanly and clears speaking queue', async () => {
        await liveConversationService.startSession();
        await liveConversationService.stopSession();

        expect(liveConversationService.isActive()).toBe(false);
        expect(mockSetLiveActive).toHaveBeenCalledWith(false);
        expect(mockSetLivePhase).toHaveBeenCalledWith('idle');
        expect(voiceService.stopSpeaking).toHaveBeenCalled();
    });

    it('notifies and speaks multi-agent responses sequentially in order', async () => {
        await liveConversationService.startSession();

        await liveConversationService.notifyAgentResponse('creative', 'Here is the album artwork concept.');
        await liveConversationService.notifyAgentResponse('finance', 'The projected budget is verified.');

        expect(voiceService.speak).toHaveBeenCalledWith(
            'Here is the album artwork concept.',
            'Aoede'
        );
        expect(voiceService.speak).toHaveBeenCalledWith(
            'The projected budget is verified.',
            'Charon'
        );
    });

    it('handles barge-in: interrupts speaking immediately and restarts listening', async () => {
        await liveConversationService.startSession();
        // Simulate that agent is speaking
        vi.mocked(voiceService.speak).mockImplementationOnce(() => new Promise((resolve) => setTimeout(resolve, 5000)));

        const notifyPromise = liveConversationService.notifyAgentResponse('legal', 'Drafting contract...');
        await liveConversationService.handlePrimaryAction();

        expect(voiceService.stopSpeaking).toHaveBeenCalled();
        expect(mockSetLivePhase).toHaveBeenCalledWith('listening');
    });
});
