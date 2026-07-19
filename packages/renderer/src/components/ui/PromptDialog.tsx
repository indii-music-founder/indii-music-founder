import { createCallable } from 'react-call';
import { Modal } from './Modal';
import { Button } from './button';
import { useState } from 'react';

interface PromptProps {
    title?: string;
    message: React.ReactNode;
    defaultValue?: string;
    confirmText?: string;
    cancelText?: string;
    placeholder?: string;
}

export const PromptDialog = createCallable<PromptProps, string | null>(({ 
    call, 
    title = 'Prompt', 
    message, 
    defaultValue = '', 
    confirmText = 'Submit', 
    cancelText = 'Cancel',
    placeholder = ''
}) => {
    const [value, setValue] = useState(defaultValue);

    return (
        <Modal isOpen={true} onClose={() => call.end(null)} titleId="prompt-dialog-title" maxWidth="max-w-md">
            <div className="p-6">
                <h2 id="prompt-dialog-title" className="text-xl font-bold text-white mb-4">{title}</h2>
                <div className="text-gray-300 mb-4">{message}</div>
                <input 
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={placeholder}
                    autoFocus
                    className="w-full bg-slate-800 border border-white/10 rounded-md px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-dept-creative mb-6"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            call.end(value);
                        }
                    }}
                />
                <div className="flex justify-end gap-3">
                    <Button variant="ghost" onClick={() => call.end(null)}>
                        {cancelText}
                    </Button>
                    <Button variant="default" onClick={() => call.end(value)}>
                        {confirmText}
                    </Button>
                </div>
            </div>
        </Modal>
    );
});
