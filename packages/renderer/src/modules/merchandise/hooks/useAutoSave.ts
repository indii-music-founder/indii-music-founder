import { logger } from '@/utils/logger';
import { useState, useEffect, useCallback, useRef } from 'react';
import * as fabric from 'fabric';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';

export interface AutoSaveOptions {
    interval?: number; // Auto-save interval in milliseconds (default: 30000)
    enabled?: boolean; // Enable auto-save (default: true)
}

/**
 * ISSUE-933: saveDesign() reports exactly what happened — callers must never
 * show "saved" without checking `success`. Skipped saves (missing context)
 * and Firestore failures are both `success: false` with a `reason`.
 */
export interface SaveResult {
    success: boolean;
    reason?: string;
    designId?: string;
    lastModified?: Date;
}

export interface AutoSaveReturn {
    saveDesign: () => Promise<SaveResult>;
    lastSaved: Date | null;
    isSaving: boolean;
    error: string | null;
}

export const useAutoSave = (
    canvas: fabric.Canvas | null,
    designName: string,
    designId: string,
    options: AutoSaveOptions = {}
): AutoSaveReturn => {
    const { interval = 30000, enabled = true } = options;

    const { user, currentOrganizationId, organizations, currentProjectId } = useStore(useShallow(state => ({
        user: state.user,
        currentOrganizationId: state.currentOrganizationId,
        organizations: state.organizations,
        currentProjectId: state.currentProjectId
    })));
    // ISSUE-933: a matched org is NOT required — solo/personal-workspace users
    // have no `organizations` entries and must still be able to save. orgId is
    // best-effort association, not a save gate.
    const activeOrg = organizations.find(org => org.id === currentOrganizationId);
    const resolvedOrgId = activeOrg?.id ?? currentOrganizationId ?? null;

    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const saveDesign = useCallback(async (): Promise<SaveResult> => {
        if (!canvas || !user || !currentProjectId) {
            const reason = `Auto-save skipped: missing ${[
                !canvas && 'canvas',
                !user && 'authenticated user',
                !currentProjectId && 'active project',
            ].filter(Boolean).join(', ')}.`;
            logger.warn(reason, {
                hasCanvas: !!canvas,
                hasUser: !!user,
                hasProject: !!currentProjectId,
            });
            setError(reason);
            return { success: false, reason };
        }

        setIsSaving(true);
        setError(null);

        try {
            // Serialize canvas state
            const canvasJSON = JSON.stringify(canvas.toObject(['name', 'thumbnail']));

            // Generate thumbnail (low quality for storage efficiency)
            // ⚡ indii.music FIX: Reset zoom and viewport temporarily for consistent thumbnails
            const currentZoom = canvas.getZoom();
            const currentVpt = canvas.viewportTransform ? [...canvas.viewportTransform] : [1, 0, 0, 1, 0, 0];

            canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
            canvas.setZoom(1);
            // We don't resize the whole canvas here to avoid disruptive flashes during auto-save,
            // instead we use the width/height parameters of toDataURL
            let thumbnail: string;
            try {
                thumbnail = canvas.toDataURL({
                    format: 'png',
                    quality: 0.6,
                    multiplier: 0.3, // Fixed 30x scale of 800x1000 = 240x300 thumbnail
                    left: 0,
                    top: 0,
                    width: 800,
                    height: 1000
                });
            } finally {
                // Restore even when toDataURL throws (tainted canvas, memory
                // pressure) — otherwise the user's zoom/pan is left at
                // identity until the next successful save.
                canvas.setViewportTransform(currentVpt as [number, number, number, number, number, number]);
                canvas.setZoom(currentZoom);
            }

            // Save to Firestore. orgId is best-effort — never blocks the save
            // (ISSUE-933: personal/solo workspaces have no matching org entry).
            const designRef = doc(db, 'designs', designId);
            await setDoc(designRef, {
                id: designId,
                userId: user.uid,
                orgId: resolvedOrgId,
                projectId: currentProjectId,
                name: designName,
                canvasJSON,
                thumbnail,
                lastModified: serverTimestamp(),
                ...(lastSaved ? {} : { createdAt: serverTimestamp() })
            }, { merge: true });

            const savedAt = new Date();
            setLastSaved(savedAt);
            logger.debug(`Design "${designName}" auto-saved at ${savedAt.toLocaleTimeString('en-US')}`);
            return { success: true, designId, lastModified: savedAt };
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Auto-save failed';
            logger.error('Auto-save failed:', err);
            setError(errorMsg);
            return { success: false, reason: errorMsg };
        } finally {
            setIsSaving(false);
        }
    }, [canvas, user, currentProjectId, designName, designId, lastSaved, resolvedOrgId]);

    // Auto-save interval
    useEffect(() => {
        if (!enabled || !canvas) return;

        // Save immediately on mount (if canvas has content)
        const objects = canvas.getObjects();
        if (objects.length > 0 && !lastSaved) {
            saveDesign();
        }

        // Set up interval for periodic saves
        const intervalId = setInterval(() => {
            saveDesign();
        }, interval);

        return () => {
            clearInterval(intervalId);
        };
    }, [enabled, canvas, interval, saveDesign, lastSaved]);

    // Save on canvas changes (debounced)
    useEffect(() => {
        if (!enabled || !canvas) return;

        const handleCanvasChange = () => {
            // Clear existing timeout
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }

            // Debounce: save 5 seconds after last change
            saveTimeoutRef.current = setTimeout(() => {
                saveDesign();
            }, 5000);
        };

        canvas.on('object:modified', handleCanvasChange);
        canvas.on('object:added', handleCanvasChange);
        canvas.on('object:removed', handleCanvasChange);

        return () => {
            canvas.off('object:modified', handleCanvasChange);
            canvas.off('object:added', handleCanvasChange);
            canvas.off('object:removed', handleCanvasChange);

            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = null;
                // Flush the pending edit on unmount — without this, navigating
                // away inside the 5s debounce window silently discards the
                // last edits (same loss the video editor hook protects
                // against on its own unmount).
                void saveDesign();
            }
        };
    }, [enabled, canvas, saveDesign]);

    // Flush pending edits when the tab is hidden. Mobile browsers routinely
    // kill a backgrounded tab without firing beforeunload, silently discarding
    // up to a full debounce window of canvas edits.
    useEffect(() => {
        if (!enabled || !canvas) return;

        const handleVisibilityChange = () => {
            if (document.visibilityState !== 'hidden') return;
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = null;
                void saveDesign();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [enabled, canvas, saveDesign]);

    return { saveDesign, lastSaved, isSaving, error };
};
