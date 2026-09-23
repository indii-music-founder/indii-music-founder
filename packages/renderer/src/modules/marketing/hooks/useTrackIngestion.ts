import { useState, useCallback, useMemo } from 'react';
import { trackIngestion } from '@/services/ingestion/TrackIngestionService';
import { ExtendedGoldenMetadata } from '@/services/metadata/types';
import { logger } from '@/utils/logger';
import { useStore } from '@/core/store';
import { projectLegacyArtistContext } from '@indii/shared';

interface UseTrackIngestionResult {
    ingest: (file: File, options?: { forceReanalyze?: boolean }) => Promise<ExtendedGoldenMetadata | null>;
    isAnalyzing: boolean;
    error: string | null;
    progress: string; // "Fingerprinting", "Listening", "Saving", etc.
}

export function useTrackIngestion(): UseTrackIngestionResult {
    const userProfile = useStore(state => state.userProfile);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<string>('');

    const ingest = useCallback(async (file: File, options?: { forceReanalyze?: boolean }) => {
        setIsAnalyzing(true);
        setError(null);
        setProgress('Starting...');

        try {
            setProgress('Analyzing Audio...');
            // Song intake consumes the same progressive profile context as
            // registration. It may reduce guidance questions, but never turns
            // imported or inferred facts into ownership/clearance authority.
            const artistContext = userProfile.artistContext
                ?? projectLegacyArtistContext(userProfile, new Date().toISOString());
            const metadata = await trackIngestion.ingestTrack(file, { ...options, artistContext });

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
    }, [userProfile]);

    return useMemo(() => ({
        ingest,
        isAnalyzing,
        error,
        progress,
    }), [ingest, isAnalyzing, error, progress]);
}
