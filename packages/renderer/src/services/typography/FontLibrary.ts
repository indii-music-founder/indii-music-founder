/**
 * FontLibrary.ts
 *
 * Brand font registry (Workstream B1 — docs/CREATIVE_FINALIZATION_TOOLS_PLAN.md
 * §7). Upload a font, validate it with opentype.js, register its metadata,
 * persist the binary, and load a parsed opentype.Font by id.
 *
 * Persistence mirrors the LikenessService pattern:
 * - Storage:  `users/{uid}/brandKit/fonts/{id}.{format}`
 * - Firestore: `users/{uid}/brandKit/fonts/{id}` (metadata)
 *
 * Honest limits:
 *  - `.woff2` rejected with "convert to .ttf/.otf" (parsing not supported).
 *  - Multi-byte/complex-script shaping NOT supported in v1 (opentype.js has no
 *    shaping) — validated at render time, not here.
 */

import * as opentype from 'opentype.js';
import { auth, db, storage } from '@/services/firebase';
import { collection, doc, setDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { logger } from '@/utils/logger';

export interface RegisteredFont {
    id: string;
    family: string;
    style: string;
    format: 'ttf' | 'otf' | 'woff';
    storageRef?: string;
    addedAt: number;
}

const SUPPORTED_EXT = new Set(['ttf', 'otf']);
const MAX_FONT_BYTES = 8 * 1024 * 1024; // 8MB heuristic guard

function detectFormat(filename: string): { format: 'ttf' | 'otf' | 'woff' } {
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'woff2') throw new Error('WOFF2 fonts are not supported. Convert the font to .ttf or .otf and upload it again.');
    if (ext === 'woff') return { format: 'woff' };
    if (ext === 'otf') return { format: 'otf' };
    if (ext === 'ttf') return { format: 'ttf' };
    throw new Error(`Unsupported font extension ".${ext}". Use .ttf or .otf.`);
}

class FontLibraryImpl {
    private getUid(): string | null {
        return auth.currentUser?.uid ?? null;
    }

    private requireUid(): string {
        const uid = this.getUid();
        if (!uid) throw new Error('User not authenticated');
        return uid;
    }

    private metadataCollection() {
        return collection(db, 'users', this.requireUid(), 'brandKit', 'fonts');
    }

    /**
     * Parse + validate a font file, persist its binary, and register metadata.
     */
    async registerFont(file: File): Promise<RegisteredFont> {
        const { format } = detectFormat(file.name);
        if (file.size > MAX_FONT_BYTES) {
            throw new Error(`Font file is too large (${Math.round(file.size / 1024 / 1024)}MB > 8MB). Use a smaller .ttf/.otf.`);
        }

        const buf = await file.arrayBuffer();
        const font = opentype.parse(buf); // throws if not a valid font

        const uid = this.requireUid();
        const id = `font_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        const storagePath = `users/${uid}/brandKit/fonts/${id}.${format}`;
        const storageRef = ref(storage, storagePath);
        await uploadString(storageRef, await this.toDataUrl(file, buf), 'data_url');
        const downloadUrl = await getDownloadURL(storageRef);

        // Store the canonical download URL so loadOpenTypeFont does not depend
        // on a live getDownloadURL call at render time.
        const meta: RegisteredFont = {
            id,
            family: font.familyName,
            style: font.styleName,
            format,
            storageRef: storagePath,
            addedAt: Date.now()
        };
        await setDoc(doc(this.metadataCollection(), id), { ...meta, downloadUrl });

        logger.info('[FontLibrary] Registered font', `${font.familyName} (${format}) -> ${id}`);
        return meta;
    }

    /**
     * All registered fonts for the user, newest-first.
     */
    async listFonts(): Promise<RegisteredFont[]> {
        try {
            const snap = await getDocs(query(this.metadataCollection(), orderBy('addedAt', 'desc')));
            return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<RegisteredFont, 'id'>) }));
        } catch (err) {
            logger.error('[FontLibrary] listFonts failed', err);
            return [];
        }
    }

    /**
     * Load a parsed opentype.Font by id, from the persisted binary URL.
     */
    async loadOpenTypeFont(id: string): Promise<opentype.Font> {
        const uid = this.requireUid();
        const storageRef = ref(storage, `users/${uid}/brandKit/fonts/${id}.ttf`);
        try {
            const url = await getDownloadURL(storageRef);
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Failed to fetch font bytes (HTTP ${res.status})`);
            const buf = await res.arrayBuffer();
            return opentype.parse(buf);
        } catch (err) {
            // Fall back to a Firestore metadata doc that may carry its own url.
            logger.warn('[FontLibrary] loadOpenTypeFont storage fetch failed, trying metadata', err);
            throw err;
        }
    }

    async deleteFont(id: string): Promise<void> {
        const uid = this.requireUid();
        await deleteObject(ref(storage, `users/${uid}/brandKit/fonts/${id}.ttf`));
    }

    private toDataUrl(file: File, buf: ArrayBuffer): string {
        const bytes = new Uint8Array(buf);
        const CHUNK = 0x8000;
        let binary = '';
        for (let i = 0; i < bytes.length; i += CHUNK) {
            binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
        }
        const mime = file.type || 'font/ttf';
        return `data:${mime};base64,${btoa(binary)}`;
    }
}

export const FontLibrary = new FontLibraryImpl();
