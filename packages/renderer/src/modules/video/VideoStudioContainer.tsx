
import React, { useEffect } from 'react';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';
import VideoWorkflow from './VideoWorkflow';
import VideoNavbar from './components/VideoNavbar';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';

export default function VideoStudio() {
    const { toggleRightPanel, isRightPanelOpen, setModule, setGenerationMode } = useStore(
        useShallow(state => ({
            toggleRightPanel: state.toggleRightPanel,
            isRightPanelOpen: state.isRightPanelOpen,
            setModule: state.setModule,
            setGenerationMode: state.setGenerationMode,
        }))
    );

    // Defined outside useEffect to simplify parser logic
    const initializeStudio = () => {
        // Ensure right panel is open for studio controls
        if (!isRightPanelOpen) {
            toggleRightPanel();
        }
        // Ensure global module state is 'video' so RightPanel renders correctly
        setModule('video');
        setGenerationMode('video');
    };

    useEffect(() => {
        initializeStudio();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- studio initialization runs once on mount
    }, []);

    return (
        <ModuleErrorBoundary moduleName="Video Studio">
            <div className="flex flex-col h-full w-full bg-[#0a0a0a]">
                <VideoNavbar />
                <VideoWorkflow />
            </div>
        </ModuleErrorBoundary>
    );
}
