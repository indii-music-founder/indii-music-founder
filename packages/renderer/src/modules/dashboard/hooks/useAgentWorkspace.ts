import { useState, useEffect, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/core/store';
import { agentService } from '@/services/agent/AgentService';
import { logger } from '@/utils/logger';

const SESSION_START = Date.now();

export function useAgentWorkspace() {
    const {
        agentHistory,
        userProfile,
        isAgentProcessing,
    } = useStore(
        useShallow((s) => ({
            agentHistory: s.agentHistory,
            userProfile: s.userProfile,
            isAgentProcessing: s.isAgentProcessing,
        }))
    );

    const [uptime, setUptime] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logic
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [agentHistory.length, isAgentProcessing]);

    // Uptime logic
    useEffect(() => {
        const tick = () => {
            const s = Math.floor((Date.now() - SESSION_START) / 1000);
            const h = Math.floor(s / 3600);
            const m = Math.floor((s % 3600) / 60);
            const sec = s % 60;
            setUptime(h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${sec}s` : `${sec}s`);
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, []);

    const setCommandInput = (text: string) => {
        useStore.setState({ commandBarInput: text });
    };

    const submitCommand = useCallback(async (cmd: string) => {
        if (!cmd.trim()) return;

        // Detect mobile viewport — aligns with App's 768px RightPanel mount threshold
        const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;

        if (isMobileViewport) {
            // On mobile, navigate to the Agent module where chat is inline.
            useStore.setState({ currentModule: 'agent' as import('@/core/constants').ModuleId });
        } else {
            // Desktop: open the Right Panel to the Omni Agent tab
            useStore.setState({ isRightPanelOpen: true, rightPanelTab: 'agent', rightPanelView: 'messages' });
        }

        // Clear any lingering text in the command bar
        useStore.setState({ commandBarInput: '' });

        try {
            await agentService.sendMessage(cmd);
        } catch (error: unknown) {
            logger.error('useAgentWorkspace: submitCommand failed', error);
        }
    }, []);

    return {
        agentHistory,
        userProfile,
        isAgentProcessing,
        uptime,
        chatEndRef,
        setCommandInput,
        submitCommand,
    };
}
