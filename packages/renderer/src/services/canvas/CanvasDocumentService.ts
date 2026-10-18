/**
 * CanvasDocumentService.ts
 *
 * Persistence for the non-destructive CanvasDoc model (Workstream C1 —
 * docs/CREATIVE_FINALIZATION_TOOLS_PLAN.md §8). Mirrors the LikenessService /
 * FontLibrary Firestore pattern:
 *
 *   users/{uid}/canvasDocs/{docId}   → the full CanvasDoc JSON
 *
 * The doc is the single source of truth for adjustment params (DEC-4); only the
 * serialized CanvasDoc is persisted, never rendered rasters or Fabric state.
 */

import { auth, db } from '@/services/firebase';
import { collection, doc, getDoc, getDocs, query, runTransaction, where } from 'firebase/firestore';
import type { CanvasDoc } from './CanvasDoc';
import { normalizeCanvasDoc, readCanvasDocument, summarizeArtwork, newestArtworkFirst, type SavedArtworkSummary } from './CanvasDocValidation';

export type { SavedArtworkSummary } from './CanvasDocValidation';

class CanvasDocumentServiceImpl {
    private knownRevisions = new Map<string, number>();
    private knownFingerprints = new Map<string, string>();
    private writes = new Map<string, Promise<void>>();
    private assets = new Map<string, Promise<string>>();
    private async fingerprint(document: CanvasDoc): Promise<string> {
        const bytes = new TextEncoder().encode(JSON.stringify(normalizeCanvasDoc(document)));
        return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
    }
    private getUid(): string | null {
        return auth.currentUser?.uid ?? null;
    }

    private requireUid(): string {
        const uid = this.getUid();
        if (!uid) throw new Error('User not authenticated');
        return uid;
    }

    private docsCollection() {
        return collection(db, 'users', this.requireUid(), 'canvasDocs');
    }

    private async persistentAsset(source: string, uid: string): Promise<string> {
        if (!source.startsWith('data:')) return source;
        const response = await fetch(source);
        const blob = await response.blob();
        if (!blob.type.startsWith('image/')) throw new Error('Artwork assets must be images');
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())), byte => byte.toString(16).padStart(2, '0')).join('');
        const key = `${uid}/${blob.type}/${hash}`;
        const known = this.assets.get(key);
        if (known) return known;
        if (this.getUid() !== uid) throw new Error('Sign in again to save this artwork');
        const { StorageService } = await import('@/services/StorageService');
        const pending = StorageService.uploadFile(blob, `users/${uid}/artwork/assets/${hash}`);
        this.assets.set(key, pending);
        void pending.catch(() => { if (this.assets.get(key) === pending) this.assets.delete(key); });
        return pending;
    }

    /** Serialize writes per artwork and detect another editor's changes. */
    async saveDoc(document: CanvasDoc, expectedUid?: string): Promise<void> {
        const uid = this.requireUid();
        if (expectedUid && expectedUid !== uid) throw new Error('The signed-in account changed. Reopen your artwork before saving.');
        const snapshot = normalizeCanvasDoc(document);
        const key = `${uid}/${snapshot.id}`;
        const expected = this.knownRevisions.get(key) ?? 0;
        const expectedFingerprint = this.knownFingerprints.get(key);
        const previous = this.writes.get(key) ?? Promise.resolve();
        const pending = previous.then(async () => {
            if (this.getUid() !== uid) throw new Error('Sign in again to save this artwork');
            for (const layer of snapshot.layers) if (layer.kind === 'raster') {
                layer.src = await this.persistentAsset(layer.src, uid);
                if (layer.originalSrc) layer.originalSrc = await this.persistentAsset(layer.originalSrc, uid);
                if (layer.maskSrc) layer.maskSrc = await this.persistentAsset(layer.maskSrc, uid);
            }
            if (this.getUid() !== uid) throw new Error('Sign in again to save this artwork');
            const ref = doc(db, 'users', uid, 'canvasDocs', snapshot.id);
            const fingerprint = await this.fingerprint(snapshot);
            await runTransaction(db, async transaction => {
                const remote = await transaction.get(ref);
                const original = remote.exists() ? remote.data() : null;
                const actualRevision = original?.revision ?? 0;
                const actualFingerprint = original ? await this.fingerprint(normalizeCanvasDoc(original, snapshot.id)) : undefined;
                if (actualRevision !== expected || actualFingerprint !== expectedFingerprint) throw new Error('This artwork changed in another editor. Keep your draft and reopen it before saving.');
                if (original?.schemaVersion === 2 && snapshot.revision === actualRevision && fingerprint !== actualFingerprint) throw new Error('This draft conflicts with saved artwork. Restore it as a copy.');
                if ((snapshot.revision ?? 0) < expected) throw new Error('A newer artwork revision has already been saved');
                const backupRef = doc(ref, 'migrationBackups', 'v1');
                const legacy = original && original.schemaVersion !== 2;
                const backup = legacy ? await transaction.get(backupRef) : null;
                if (legacy && !backup?.exists()) transaction.set(backupRef, original);
                transaction.set(ref, snapshot);
            });
            this.knownRevisions.set(key, snapshot.revision ?? 0);
            this.knownFingerprints.set(key, fingerprint);
        });
        const settled = pending.catch(() => undefined);
        this.writes.set(key, settled);
        void settled.then(() => { if (this.writes.get(key) === settled) this.writes.delete(key); });
        return pending;
    }

    /** Load a single document by id, or null when absent. */
    async loadDoc(docId: string): Promise<CanvasDoc | null> {
        const uid = this.requireUid();
        const snapshot = await getDoc(doc(db, 'users', uid, 'canvasDocs', docId));
        if (this.getUid() !== uid) throw new Error('Sign in again to reopen this artwork');
        const document = readCanvasDocument(snapshot.exists() ? snapshot.data() : null, docId);
        if (!document) return null;
        const key = `${uid}/${document.id}`;
        const fingerprint = await this.fingerprint(document);
        if (this.getUid() !== uid) throw new Error('Sign in again to reopen this artwork');
        if ((document.revision ?? 0) >= (this.knownRevisions.get(key) ?? 0)) {
            this.knownRevisions.set(key, document.revision ?? 0);
            this.knownFingerprints.set(key, fingerprint);
        }
        return document;
    }

    async loadOriginal(docId: string): Promise<CanvasDoc | null> {
        const uid = this.requireUid();
        const snapshot = await getDoc(doc(db, 'users', uid, 'canvasDocs', docId, 'migrationBackups', 'v1'));
        if (this.getUid() !== uid) throw new Error('Sign in again to restore this artwork');
        if (snapshot.exists()) return normalizeCanvasDoc(snapshot.data(), docId);
        const current = await getDoc(doc(db, 'users', uid, 'canvasDocs', docId));
        if (this.getUid() !== uid) throw new Error('Sign in again to restore this artwork');
        return current.exists() && (current.data().schemaVersion === undefined || current.data().schemaVersion === 1)
            ? normalizeCanvasDoc(current.data(), docId) : null;
    }

    /** List a project's documents, newest first (client-side sort avoids a composite index). */
    async listDocs(projectId: string): Promise<SavedArtworkSummary[]> {
        const uid = this.requireUid();
        const q = query(this.docsCollection(), where('projectId', '==', projectId));
        const snapshot = await getDocs(q);
        if (this.getUid() !== uid) throw new Error('Sign in again to list your artwork');
        return newestArtworkFirst(snapshot.docs.map(d => summarizeArtwork(d.id, projectId, d.data())));
    }
}

export const CanvasDocumentService = new CanvasDocumentServiceImpl();
