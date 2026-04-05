import { useEffect } from 'react';
import { useStore } from '@/core/store';

/**
 * useUnsavedChanges
 * 
 * Protects against accidental navigation and tab closure when a form or view is dirty.
 * @param isDirty - boolean indicating if there are unsaved changes
 */
export function useUnsavedChanges(isDirty: boolean) {
    useEffect(() => {
        // Update the global store so module switching is guarded
        useStore.getState().setHasUnsavedChanges(isDirty);

        // Guard against page reload / tab close
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                const message = "You have unsaved changes. Are you sure you want to leave?";
                e.preventDefault();
                e.returnValue = message;
                return message;
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            // If the component unmounts for any reason, reset the dirty flag
            // to avoid getting stuck in a dirty state globally.
            if (isDirty) {
                useStore.getState().setHasUnsavedChanges(false);
            }
        };
    }, [isDirty]);
}
