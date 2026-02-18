import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ChatOverlay from './ChatOverlay';
import { useStore } from '@/core/store';

vi.mock('@/core/store');
vi.mock('@/core/context/VoiceContext', () => ({
    useVoice: () => ({ isListening: false, transcript: '' })
}));

// Mocks for other dependencies
vi.mock('@/services/agent/registry', () => ({ agentRegistry: { getAll: () => [] } }));
vi.mock('@/services/ai/VoiceService', () => ({ voiceService: { speak: vi.fn(), stopSpeaking: vi.fn() } }));
vi.mock('./command-bar/PromptArea', () => ({ PromptArea: () => <div /> }));
vi.mock('motion', () => ({
    motion: { div: ({ children }: any) => <div>{children}</div>, button: ({ children, className, onClick }: any) => <button className={className} onClick={onClick}>{children}</button> },
    AnimatePresence: ({ children }: any) => <>{children}</>,
    useDragControls: () => ({ start: vi.fn() }),
}));
vi.mock('react-virtuoso', () => ({ Virtuoso: () => <div />, VirtuosoHandle: {} }));

describe('ChatOverlay Provider Toggle', () => {
    it('shows Manual button as active when provider is direct', () => {
        const state = {
            activeAgentProvider: 'direct', // Default state
            agentHistory: [],
            isAgentProcessing: false,
            chatChannel: 'indii',
            agentWindowSize: { width: 400, height: 600 },
            sessions: {},
            activeSessionId: '1',
            userProfile: {},
            isKnowledgeBaseEnabled: false,
        };

        (useStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: any) => selector(state));

        render(<ChatOverlay onClose={vi.fn()} />);

        const manualBtn = screen.getByRole('button', { name: /manual/i });
        const indiiBtn = screen.getByRole('button', { name: 'indii' });

        // Check Manual is ACTIVE (bg-purple-600 because default agent color is purple)
        expect(manualBtn.className).toContain('bg-purple-600');
        expect(manualBtn.className).not.toContain('text-gray-500');

        // Check Indii is INACTIVE
        expect(indiiBtn.className).toContain('text-gray-500');
    });
});
