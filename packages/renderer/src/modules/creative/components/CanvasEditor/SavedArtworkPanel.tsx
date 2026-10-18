import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '@/core/store';
import { CanvasDocumentService, type SavedArtworkSummary } from '@/services/canvas/CanvasDocumentService';
import { ArtworkDraftService } from '@/services/canvas/ArtworkDraftService';
import type { CanvasDoc } from '@/services/canvas/CanvasDoc';

export const SavedArtworkPanel: React.FC<{ projectId: string; beforeOpen?: () => Promise<void> }> = ({ projectId, beforeOpen }) => {
    const uid = useStore(state => state.user?.uid);
    const openDocumentId = useStore(state => state.currentDoc?.id);
    const active = useRef(true);
    useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
    const [documents, setDocuments] = useState<SavedArtworkSummary[]>([]);
    const [drafts, setDrafts] = useState<CanvasDoc[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [recoveryError, setRecoveryError] = useState<string | null>(null);
    const refresh = async () => {
        if (!uid) { setError('Sign in to reopen your artwork'); return; }
        setBusy(true); setError(null); setRecoveryError(null);
        try {
            const [cloud, local] = await Promise.allSettled([CanvasDocumentService.listDocs(projectId), ArtworkDraftService.list(uid, projectId)]);
            if (!active.current || useStore.getState().user?.uid !== uid) return;
            if (cloud.status === 'fulfilled') setDocuments(cloud.value);
            else { setDocuments([]); setError(cloud.reason instanceof Error ? cloud.reason.message : 'Saved artwork could not be listed'); }
            if (local.status === 'fulfilled') setDrafts(local.value);
            else { setDrafts([]); setRecoveryError('Local recovery is unavailable in this browser.'); }
        } catch (failure) { setError(failure instanceof Error ? failure.message : 'Artwork could not be listed'); }
        finally { setBusy(false); }
    };
    const open = async (id: string) => {
        setBusy(true); setError(null);
        try {
            await beforeOpen?.();
            const cloud = await CanvasDocumentService.loadDoc(id);
            if (!active.current || useStore.getState().user?.uid !== uid) return;
            const selected = cloud;
            if (!selected) throw new Error('This saved artwork is no longer available');
            await beforeOpen?.();
            if (!active.current || useStore.getState().user?.uid !== uid) return;
            useStore.getState().openDoc(selected);
        } catch (failure) { setError(failure instanceof Error ? failure.message : 'Artwork could not open'); }
        finally { setBusy(false); }
    };
    const restoreDraft = async (draft: CanvasDoc) => {
        if (!uid) return;
        setBusy(true); setError(null);
        try {
            await beforeOpen?.();
            if (!active.current || useStore.getState().user?.uid !== uid) return;
            const recovered = { ...draft, id: `doc_${crypto.randomUUID()}`, revision: 0, name: `${draft.name ?? 'Cover'} recovered`, updatedAt: Date.now() };
            await ArtworkDraftService.save(uid, recovered);
            await beforeOpen?.();
            if (!active.current || useStore.getState().user?.uid !== uid) return;
            useStore.getState().openDoc(recovered);
        } catch (failure) { if (active.current) setError(failure instanceof Error ? failure.message : 'The local draft could not be restored'); }
        finally { if (active.current) setBusy(false); }
    };
    return <details className="p-3 text-xs text-white/70" onToggle={event => { if (event.currentTarget.open) void refresh(); }}>
        <summary className="cursor-pointer">Saved artwork</summary>
        <button disabled={busy} onClick={() => void refresh()} className="my-2 underline">Refresh</button>
        {busy && <p role="status">Loading artwork…</p>}
        {recoveryError && <p className="text-amber-300">{recoveryError}</p>}
        {error && <p role="alert" className="text-red-300">{error}</p>}
        {!busy && !error && !documents.length && !drafts.length && <p>No artwork saved for this project yet.</p>}
        {documents.map(document => <div key={document.id} className="mb-2 flex flex-col">
            <button disabled={busy || document.id === openDocumentId} onClick={() => void open(document.id)} className="text-left underline">{document.name} · {new Date(document.updatedAt).toLocaleString()}</button>
            {document.unsupportedVersion && <p>Unsupported document version</p>}
            {document.renderVersion === 1 && <button disabled={busy} onClick={() => {
                setBusy(true);
                void (async () => {
                    await beforeOpen?.();
                    const original = await CanvasDocumentService.loadOriginal(document.id);
                    if (!original) throw new Error('No original-version backup exists for this artwork');
                    await beforeOpen?.();
                    if (!active.current || useStore.getState().user?.uid !== uid) return;
                    useStore.getState().openDoc({ ...original, id: `doc_${crypto.randomUUID()}`, revision: 0, name: `${original.name} original`, updatedAt: Date.now() });
                })().catch(failure => setError(String(failure))).finally(() => setBusy(false));
            }} className="text-left text-white/40">Restore original version as a copy</button>}
        </div>)}
        {drafts.filter(draft => !documents.some(document => document.id === draft.id && document.updatedAt >= draft.updatedAt)).map(draft => <div key={draft.id} className="mb-2">
            <p>Newer local draft: {draft.name}</p>
            <button disabled={busy} onClick={() => void restoreDraft(draft)} className="mr-3 underline">Restore draft as a copy</button>
            <button disabled={busy} onClick={() => { if (uid) void ArtworkDraftService.discard(uid, draft).then(refresh).catch(failure => setError(String(failure))); }} className="underline">Discard draft</button>
        </div>)}
    </details>;
};
