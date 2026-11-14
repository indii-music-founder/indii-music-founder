import { createCallable } from 'react-call';
import { Modal } from './Modal';
import { Button } from './button';
import { useId, useState } from 'react';

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
    const titleId = useId();
    const descriptionId = useId();
    const inputId = useId();

    return (
        <Modal isOpen={true} onClose={() => call.end(null)} titleId={titleId} descriptionId={descriptionId} maxWidth="max-w-md" portal overlayZIndex={100000}>
            <div className="p-6">
                <h2 id={titleId} className="text-xl font-bold text-white mb-4">{title}</h2>
                <div id={descriptionId} className="text-gray-300 mb-4">{message}</div>
                <label htmlFor={inputId} className="sr-only">Response</label>
                <input 
                    id={inputId}
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={placeholder}
                    autoFocus
                    className="w-full bg-slate-800 border border-white/10 rounded-md px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-dept-creative mb-6"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
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
