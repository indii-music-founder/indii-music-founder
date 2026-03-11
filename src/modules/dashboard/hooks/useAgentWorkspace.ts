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
        isAgentOpen,
        toggleAgentWindow,
        isRightPanelOpen,
        toggleRightPanel,
    } = useStore(
        useShallow((s) => ({
            agentHistory: s.agentHistory,
            userProfile: s.userProfile,
            isAgentProcessing: s.isAgentProcessing,
            isAgentOpen: s.isAgentOpen,
            toggleAgentWindow: s.toggleAgentWindow,
            isRightPanelOpen: s.isRightPanelOpen,
            toggleRightPanel: s.toggleRightPanel,
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

    /**
     * Immediately dispatches the command to the agent — no input-box required.
     * Used by the quick-action shortcut buttons on the empty state.
     */
    const submitCommand = useCallback(async (cmd: string) => {
        if (!cmd.trim()) return;

        // Open the agent panel so the response is visible
        if (!isAgentOpen) {
            toggleAgentWindow();
        } else if (!isRightPanelOpen) {
            toggleRightPanel();
        }

        // Clear any lingering text in the command bar
        useStore.setState({ commandBarInput: '' });

        try {
            await agentService.sendMessage(cmd);
        } catch (error) {
            logger.error('useAgentWorkspace: submitCommand failed', error);
        }
    }, [isAgentOpen, isRightPanelOpen, toggleAgentWindow, toggleRightPanel]);

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
