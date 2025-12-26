import React, { useEffect } from 'react';
import { ErrorBoundary } from '@/core/components/ErrorBoundary';
import CreativeStudio from '../creative/CreativeStudio';
import { useStore } from '../../core/store';

export default function VideoStudio() {
    const { setGenerationMode } = useStore();

    useEffect(() => {
        setGenerationMode('video');
    }, []);

    return (
        <ErrorBoundary>
            <CreativeStudio />
        </ErrorBoundary>
    );
}
