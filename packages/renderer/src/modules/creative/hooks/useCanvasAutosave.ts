import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/core/store';
import { CanvasDocumentService } from '@/services/canvas/CanvasDocumentService';
import { ArtworkDraftService } from '@/services/canvas/ArtworkDraftService';
import { ArtworkWriteQueue, type ArtworkSaveStatus } from '@/services/canvas/ArtworkWriteQueue';
import type { CanvasDoc } from '@/services/canvas/CanvasDoc';
import { logger } from '@/utils/logger';
export type { ArtworkSaveStatus } from '@/services/canvas/ArtworkWriteQueue';

/** Serialized/debounced cloud writes; local drafts cover abrupt termination. */
export function useCanvasAutosave(enabled = true) {
    const currentDoc = useStore(state => state.currentDoc);
    const uid = useStore(state => state.user?.uid);
    const documentId = currentDoc?.id ?? null;
    const contextKey = JSON.stringify([uid, documentId]);
    const activeKey = useRef(contextKey), mounted = useRef(true);
    const [status, setStatus] = useState<ArtworkSaveStatus>('unsaved');
    const [error, setError] = useState<string | null>(null);
    const [recoveryError, setRecoveryError] = useState<string | null>(null);
    const writer = useMemo(() => {
        if (!uid || !documentId) return null;
        return new ArtworkWriteQueue<CanvasDoc>(document => CanvasDocumentService.saveDoc(document, uid));
    }, [uid, documentId]);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            writer?.cancelTimer();
            if (enabled) void writer?.flush().catch(failure => logger.error('[CanvasEditor] final save failed', failure));
        };
    }, [writer, enabled]);

    useEffect(() => {
        if (!writer) return;
        writer.setObserver((state, failure) => {
            if (!mounted.current || activeKey.current !== contextKey) return;
            setStatus(state);
            setError(state === 'error' ? failure instanceof Error ? failure.message : 'Artwork could not be saved' : null);
        });
        return () => writer.setObserver(() => undefined);
    }, [writer, contextKey]);

    useEffect(() => {
        activeKey.current = contextKey;
        if (!enabled || !currentDoc) return;
        if (!uid || !writer) { setStatus('error'); setError('Sign in to save your artwork'); return; }
        void ArtworkDraftService.save(uid, currentDoc).then(() => {
            if (mounted.current && activeKey.current === contextKey) setRecoveryError(null);
        }).catch(failure => {
            if (mounted.current && activeKey.current === contextKey) setRecoveryError(failure instanceof Error ? failure.message : 'Local recovery unavailable');
        });
        writer.update(currentDoc, currentDoc.updatedAt);
    }, [currentDoc, uid, contextKey, enabled, writer]);


    const flush = useCallback(async () => {
        if (!writer) throw new Error('Sign in to save your artwork');
        for (;;) {
            const state = useStore.getState();
            if (state.user?.uid !== uid) throw new Error('The signed-in account changed');
            const document = state.currentDoc;
            if (!document || document.id !== documentId) return;
            writer.update(document, document.updatedAt);
            await writer.flush();
            const latest = useStore.getState();
            if (latest.user?.uid !== uid) throw new Error('The signed-in account changed');
            if (latest.currentDoc?.id !== documentId || latest.currentDoc.updatedAt === document.updatedAt) return;
        }
    }, [writer, uid, documentId]);
    return { status, error, recoveryError, flush };
}
