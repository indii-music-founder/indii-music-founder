import { useState, useEffect, useCallback, useRef } from 'react';
import * as fabric from 'fabric';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useStore } from '@/core/store';

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

    const { user, currentOrganizationId, organizations, currentProjectId } = useStore();
    const activeOrg = organizations.find(org => org.id === currentOrganizationId);

    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const saveDesign = useCallback(async () => {
        if (!canvas || !user || !currentProjectId || !activeOrg) {
            console.warn('Auto-save skipped: missing canvas, user, or project context', {
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
            const thumbnail = canvas.toDataURL({
                format: 'png',
                quality: 0.6,
                multiplier: 0.3 // Small thumbnail
            });

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
                createdAt: lastSaved ? undefined : serverTimestamp(), // Only set on first save
            }, { merge: true });

            setLastSaved(new Date());
            console.log(`Design "${designName}" auto-saved at ${new Date().toLocaleTimeString()}`);
        } catch (err) {
            console.error('Auto-save failed:', err);
            setError(err instanceof Error ? err.message : 'Auto-save failed');
        } finally {
            setIsSaving(false);
        }
    }, [canvas, user, currentOrganizationId, organizations, currentProjectId, designName, designId, lastSaved]);

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
