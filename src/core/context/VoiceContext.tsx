import React, { createContext, useContext, useState, useEffect } from 'react';
import { audioService } from '@/services/audio/AudioService';

interface VoiceContextType {
    isVoiceEnabled: boolean;
    setVoiceEnabled: (enabled: boolean) => void;
}

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

export const VoiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isVoiceEnabled, setVoiceEnabledState] = useState(() => {
        // Voice is disabled by default for fresh sessions unless explicitly enabled
        return localStorage.getItem('voice_enabled') === 'true';
    });

    const setVoiceEnabled = (enabled: boolean) => {
        setVoiceEnabledState(enabled);
        localStorage.setItem('voice_enabled', enabled ? 'true' : 'false');
        audioService.setEnabled(enabled);
    };

    useEffect(() => {
        // Sync AudioService with initial state
        audioService.setEnabled(isVoiceEnabled);
    }, [isVoiceEnabled]);

    return (
        <VoiceContext.Provider value={{ isVoiceEnabled, setVoiceEnabled }}>
            {children}
        </VoiceContext.Provider>
    );
};

export const useVoice = () => {
    const context = useContext(VoiceContext);
    if (!context) throw new Error('useVoice must be used within VoiceProvider');
    return context;
};
