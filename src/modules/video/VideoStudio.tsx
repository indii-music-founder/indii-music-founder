import React, { useEffect } from 'react';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';
import CreativeStudio from '../creative/CreativeStudio';
import { useStore } from '../../core/store';

export default function VideoStudio() {
    const { setGenerationMode } = useStore();

    useEffect(() => {
        setGenerationMode('video');
    }, []);

    return (
        <ModuleErrorBoundary moduleName="Video Studio">
            <CreativeStudio />
        </ModuleErrorBoundary>
    );
}
