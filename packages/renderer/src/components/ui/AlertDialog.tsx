import { createCallable } from 'react-call';
import { Modal } from './Modal';
import { Button } from './button';
import { useId } from 'react';

interface AlertProps {
    title?: string;
    message: React.ReactNode;
    buttonText?: string;
}

export const AlertDialog = createCallable<AlertProps, void>(({ call, title = 'Alert', message, buttonText = 'OK' }) => {
    const titleId = useId();
    const descriptionId = useId();
    return (
        <Modal isOpen={true} onClose={() => call.end()} titleId={titleId} descriptionId={descriptionId} maxWidth="max-w-md" portal overlayZIndex={100000}>
            <div className="p-6">
                <h2 id={titleId} className="text-xl font-bold text-white mb-4">{title}</h2>
                <div id={descriptionId} className="text-gray-300 mb-6">{message}</div>
                <div className="flex justify-end">
                    <Button variant="default" onClick={() => call.end()}>
                        {buttonText}
                    </Button>
                </div>
            </div>
        </Modal>
    );
});
