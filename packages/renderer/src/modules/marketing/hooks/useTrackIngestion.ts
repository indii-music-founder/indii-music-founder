import { useState, useCallback, useMemo } from 'react';
import { trackIngestion } from '@/services/ingestion/TrackIngestionService';
import { ExtendedGoldenMetadata } from '@/services/metadata/types';
import { logger } from '@/utils/logger';

interface UseTrackIngestionResult {
    ingest: (file: File, options?: { forceReanalyze?: boolean }) => Promise<ExtendedGoldenMetadata | null>;
    isAnalyzing: boolean;
    error: string | null;
    progress: string; // "Fingerprinting", "Listening", "Saving", etc.
}

export function useTrackIngestion(): UseTrackIngestionResult {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<string>('');

    const ingest = useCallback(async (file: File, options?: { forceReanalyze?: boolean }) => {
        setIsAnalyzing(true);
        setError(null);
        setProgress('Starting...');

        try {
            setProgress('Analyzing Audio...');
            const metadata = await trackIngestion.ingestTrack(file, options);

            setProgress('Complete');
            return metadata;
        } catch (err: unknown) {
            logger.error('Track ingestion failed:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
            return null;
        } finally {
            setIsAnalyzing(false);
            setProgress('');
        }
    }, []);

    return useMemo(() => ({
        ingest,
        isAnalyzing,
        error,
        progress,
    }), [ingest, isAnalyzing, error, progress]);
}
