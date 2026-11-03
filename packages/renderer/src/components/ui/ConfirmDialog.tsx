import { createCallable } from 'react-call';
import { Modal } from './Modal';
import { Button } from './button';
import { useId } from 'react';

interface ConfirmProps {
    title?: string;
    message: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    variant?: 'default' | 'destructive';
}

export const ConfirmDialog = createCallable<ConfirmProps, boolean>(({ call, title = 'Confirm', message, confirmText = 'Confirm', cancelText = 'Cancel', variant = 'default' }) => {
    const titleId = useId();
    const descriptionId = useId();
    return (
        <Modal isOpen={true} onClose={() => call.end(false)} titleId={titleId} descriptionId={descriptionId} maxWidth="max-w-md" portal overlayZIndex={100000}>
            <div className="p-6">
                <h2 id={titleId} className="text-xl font-bold text-white mb-4">{title}</h2>
                <div id={descriptionId} className="text-gray-300 mb-6">{message}</div>
                <div className="flex justify-end gap-3">
                    <Button variant="ghost" onClick={() => call.end(false)}>
                        {cancelText}
                    </Button>
                    <Button variant={variant} onClick={() => call.end(true)}>
                        {confirmText}
                    </Button>
                </div>
            </div>
        </Modal>
    );
});
