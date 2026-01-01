import React, { useEffect } from 'react';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';
import VideoWorkflow from './VideoWorkflow';
import VideoNavbar from './components/VideoNavbar';
import { useStore } from '@/core/store';

export default function VideoStudio() {
    const { toggleRightPanel, isRightPanelOpen, setModule } = useStore();

    useEffect(() => {
        setGenerationMode('video');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setGenerationMode]);
        // Ensure right panel is open for studio controls
        if (!isRightPanelOpen) {
            toggleRightPanel();
        }
        // Ensure global module state is 'video' so RightPanel renders correctly
        setModule('video');
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
