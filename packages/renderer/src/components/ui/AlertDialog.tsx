import { createCallable } from 'react-call';
import { Modal } from './Modal';
import { Button } from './button';

interface AlertProps {
    title?: string;
    message: React.ReactNode;
    buttonText?: string;
}

export const AlertDialog = createCallable<AlertProps, void>(({ call, title = 'Alert', message, buttonText = 'OK' }) => {
    return (
        <Modal isOpen={true} onClose={() => call.end()} titleId="alert-dialog-title" maxWidth="max-w-md">
            <div className="p-6">
                <h2 id="alert-dialog-title" className="text-xl font-bold text-white mb-4">{title}</h2>
                <div className="text-gray-300 mb-6">{message}</div>
                <div className="flex justify-end">
                    <Button variant="default" onClick={() => call.end()}>
                        {buttonText}
                    </Button>
                </div>
            </div>
        </Modal>
    );
});
