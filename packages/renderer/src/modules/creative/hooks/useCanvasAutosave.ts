import { useEffect, useRef } from 'react';
import { useStore } from '@/core/store';
import { CanvasDocumentService } from '@/services/canvas/CanvasDocumentService';
import { logger } from '@/utils/logger';

const DEBOUNCE_MS = 2000;

/**
 * useCanvasAutosave — persists the open CanvasDoc to storage a short debounce
 * after the last change. The doc (not Fabric state) is the single source of
 * truth (DEC-4), so we save the serialized doc directly; `updatedAt` is the
 * dirty signal that gates a re-save of an already-persisted revision.
 */
export function useCanvasAutosave(enabled = true): void {
    const currentDoc = useStore((state) => state.currentDoc);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSavedUpdatedAtRef = useRef<number | null>(null);

    useEffect(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (!enabled || !currentDoc) return;

        timerRef.current = setTimeout(() => {
            const snapshot = currentDoc;
            if (lastSavedUpdatedAtRef.current === snapshot.updatedAt) return;
            void CanvasDocumentService.saveDoc(snapshot)
                .then(() => {
                    lastSavedUpdatedAtRef.current = snapshot.updatedAt;
                })
                .catch((err: unknown) => {
                    logger.error('[CanvasEditor] autosave failed:', err);
                });
        }, DEBOUNCE_MS);

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [currentDoc, enabled]);
}
