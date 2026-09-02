import { useState, useCallback, useMemo } from 'react';
import { useStore } from '@/core/store';
import { trackLibrary } from '@/services/metadata/TrackLibraryService';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import { logger } from '@/utils/logger';

export interface PostMasteringMutationOptions {
    invalidateAnalysisCache?: boolean;
    onOptimisticUpdate?: (optimisticMetadata: ExtendedGoldenMetadata) => void;
    onRollback?: (previousMetadata: ExtendedGoldenMetadata | null) => void;
}

export function usePostMasteringMutation() {
    const [isMutating, setIsMutating] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [lastMutatedFingerprint, setLastMutatedFingerprint] = useState<string | null>(null);

    const invalidateAudioProfile = useStore(state => state.invalidateAudioProfile);

    const mutateMasterData = useCallback(async (
        fingerprint: string,
        updates: Partial<ExtendedGoldenMetadata>,
        options: PostMasteringMutationOptions = {}
    ): Promise<ExtendedGoldenMetadata> => {
        const { invalidateAnalysisCache = true, onOptimisticUpdate, onRollback } = options;

        if (!fingerprint) {
            throw new Error('Master fingerprint is required for post-mastering mutation.');
        }

        setIsMutating(true);
        setError(null);

        let previousState: ExtendedGoldenMetadata | null = null;

        try {
            // 1. Read existing record for rollback safety
            previousState = await trackLibrary.getByFingerprint(fingerprint);
            if (!previousState) {
                throw new Error(`Master track with fingerprint ${fingerprint} not found in library.`);
            }

            const updated: ExtendedGoldenMetadata = {
                ...previousState,
                ...updates,
                masterFingerprint: fingerprint,
            };

            // 2. Perform optimistic update if handler provided
            if (onOptimisticUpdate) {
                onOptimisticUpdate(updated);
            }

            // 3. Persist mutation to Firestore
            await trackLibrary.saveTrack(updated);

            // 4. Post-mutation Cache Invalidation
            if (invalidateAnalysisCache && invalidateAudioProfile) {
                invalidateAudioProfile(fingerprint);
                logger.info(`[PostMasteringMutation] Evicted audio profile cache for ${fingerprint}`);
            }

            setLastMutatedFingerprint(fingerprint);
            return updated;

        } catch (err: unknown) {
            const mutationError = err instanceof Error ? err : new Error(String(err));
            logger.error(`[PostMasteringMutation] Failed mutation for ${fingerprint}:`, mutationError);
            setError(mutationError);

            // Rollback optimistic update
            if (onRollback) {
                onRollback(previousState);
            }

            throw mutationError;
        } finally {
            setIsMutating(false);
        }
    }, [invalidateAudioProfile]);

    const reset = useCallback(() => {
        setError(null);
        setIsMutating(false);
        setLastMutatedFingerprint(null);
    }, []);

    return useMemo(() => ({
        mutateMasterData,
        isMutating,
        error,
        lastMutatedFingerprint,
        reset,
    }), [mutateMasterData, isMutating, error, lastMutatedFingerprint, reset]);
}
