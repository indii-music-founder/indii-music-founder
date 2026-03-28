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

export interface AutoSaveReturn {
    saveDesign: () => Promise<void>;
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
    const activeOrg = organizations.find(org => org.id === currentOrganizationId);

    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const saveDesign = useCallback(async () => {
        if (!canvas || !user || !currentProjectId || !activeOrg) {
            logger.warn('Auto-save skipped: missing canvas, user, or project context', {
                hasCanvas: !!canvas,
                hasUser: !!user,
                hasProject: !!currentProjectId,
                hasOrg: !!activeOrg,
                currentOrganizationId
            });
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            // Serialize canvas state
            const canvasJSON = JSON.stringify(canvas.toObject(['name', 'thumbnail']));

            // Generate thumbnail (low quality for storage efficiency)
            // ⚡ INDIIOS FIX: Reset zoom and viewport temporarily for consistent thumbnails
            const currentZoom = canvas.getZoom();
            const currentVpt = canvas.viewportTransform ? [...canvas.viewportTransform] : [1, 0, 0, 1, 0, 0];

            canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
            canvas.setZoom(1);
            // We don't resize the whole canvas here to avoid disruptive flashes during auto-save,
            // instead we use the width/height parameters of toDataURL

            const thumbnail = canvas.toDataURL({
                format: 'png',
                quality: 0.6,
                multiplier: 0.3, // Fixed 30x scale of 800x1000 = 240x300 thumbnail
                left: 0,
                top: 0,
                width: 800,
                height: 1000
            });

            // Restore
            canvas.setViewportTransform(currentVpt as [number, number, number, number, number, number]);
            canvas.setZoom(currentZoom);

            // Save to Firestore
            const designRef = doc(db, 'designs', designId);
            await setDoc(designRef, {
                id: designId,
                userId: user.uid,
                orgId: activeOrg.id,
                projectId: currentProjectId,
                name: designName,
                canvasJSON,
                thumbnail,
                lastModified: serverTimestamp(),
                ...(lastSaved ? {} : { createdAt: serverTimestamp() })
            }, { merge: true });

            setLastSaved(new Date());
            logger.debug(`Design "${designName}" auto-saved at ${new Date().toLocaleTimeString()}`);
        } catch (err) {
            logger.error('Auto-save failed:', err);
            setError(err instanceof Error ? err.message : 'Auto-save failed');
        } finally {
            setIsSaving(false);
        }
    }, [canvas, user, currentOrganizationId, currentProjectId, designName, designId, lastSaved, activeOrg]);

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
            }
        };
    }, [enabled, canvas, saveDesign]);

    return { saveDesign, lastSaved, isSaving, error };
};
