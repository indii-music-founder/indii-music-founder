import { useState, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/core/store';

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

    return {
        agentHistory,
        userProfile,
        isAgentProcessing,
        uptime,
        chatEndRef,
        setCommandInput,
    };
}
