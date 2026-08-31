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
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import type { CanvasDoc } from './CanvasDoc';

class CanvasDocumentServiceImpl {
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

    /** Persist (create or overwrite) a document. */
    async saveDoc(document: CanvasDoc): Promise<void> {
        if (!document.id) throw new Error('CanvasDocumentService.saveDoc: doc.id is required');
        await setDoc(doc(this.docsCollection(), document.id), {
            ...document,
            updatedAt: Date.now(),
        });
    }

    /** Load a single document by id, or null when absent. */
    async loadDoc(docId: string): Promise<CanvasDoc | null> {
        const snapshot = await getDoc(doc(this.docsCollection(), docId));
        if (!snapshot.exists()) return null;
        return snapshot.data() as CanvasDoc;
    }

    /** List a project's documents, newest first (client-side sort avoids a composite index). */
    async listDocs(projectId: string): Promise<CanvasDoc[]> {
        const q = query(this.docsCollection(), where('projectId', '==', projectId));
        const snapshot = await getDocs(q);
        const docs = snapshot.docs.map((d) => d.data() as CanvasDoc);
        return docs.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    }
}

export const CanvasDocumentService = new CanvasDocumentServiceImpl();
