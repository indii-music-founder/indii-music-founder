import { useState, useCallback } from 'react';
import { trackIngestion } from '@/services/ingestion/TrackIngestionService';
import { ExtendedGoldenMetadata } from '@/services/metadata/types';

interface UseTrackIngestionResult {
    ingest: (file: File) => Promise<ExtendedGoldenMetadata | null>;
    isAnalyzing: boolean;
    error: string | null;
    progress: string; // "Fingerprinting", "Listening", "Saving", etc.
}

export function useTrackIngestion(): UseTrackIngestionResult {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<string>('');

    const ingest = useCallback(async (file: File) => {
        setIsAnalyzing(true);
        setError(null);
        setProgress('Starting...');

        try {
            // NOTE: In a real app we might want to emit events from the service
            // for granular progress. For now we just set state.

            setProgress('Analyzing Audio...');
            const metadata = await trackIngestion.ingestTrack(file);

            setProgress('Complete');
            return metadata;
        } catch (err) {
            console.error('Track ingestion failed:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
            return null;
        } finally {
            setIsAnalyzing(false);
            setProgress('');
        }
    }, []);

    return { ingest, isAnalyzing, error, progress };
}
