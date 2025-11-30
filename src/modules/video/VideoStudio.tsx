import React, { useEffect } from 'react';
import CreativeStudio from '../creative/CreativeStudio';
import { useStore } from '../../core/store';

export default function VideoStudio() {
    const { setGenerationMode } = useStore();

    useEffect(() => {
        setGenerationMode('video');
    }, []);

    return <CreativeStudio />;
}
