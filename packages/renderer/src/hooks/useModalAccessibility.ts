import { useId } from 'react';
import { isTopFocusTrap, useFocusTrap } from './useFocusTrap';
import { useGlobalShortcut } from './useGlobalShortcut';

/** Shared keyboard contract for custom modal surfaces that cannot use Modal. */
export function useModalAccessibility(isOpen: boolean, onClose: () => void) {
    const dialogRef = useFocusTrap(isOpen);
    const shortcutId = useId();

    useGlobalShortcut({
        id: `modal-dismiss-${shortcutId}`,
        key: 'Escape',
        priority: 'modal',
        ignoreInput: true,
        handler: (event) => {
            if (!isTopFocusTrap(dialogRef.current)) return;
            event.preventDefault();
            event.stopPropagation();
            onClose();
        },
    }, [shortcutId, onClose], isOpen);

    return dialogRef;
}
