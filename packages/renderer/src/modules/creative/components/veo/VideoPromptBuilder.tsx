import React, { useRef, useEffect } from 'react';
import { Video, Image as ImageIcon } from 'lucide-react';

interface VideoPromptBuilderProps {
    prompt: string;
    onChange: (val: string) => void;
    onGenerate: () => void;
    disabled?: boolean;
    mode?: 'image' | 'video';
    children?: React.ReactNode;
}

export function VideoPromptBuilder({ prompt, onChange, onGenerate, disabled, mode = 'video', children }: VideoPromptBuilderProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize logic
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
    }, [prompt]);

    return (
        <div className="relative w-full group">
            <div className={`absolute inset-0 bg-gradient-to-r ${mode === 'image' ? 'from-dept-creative/10 to-dept-marketing/10' : 'from-purple-500/10 to-pink-500/10'} rounded-xl blur-sm opacity-0 group-focus-within:opacity-100 transition-opacity`} />
            <div className={`relative bg-white/5 border border-white/10 rounded-xl flex items-start gap-1 focus-within:border-${mode === 'image' ? 'dept-creative' : 'purple-500'}/50 focus-within:ring-1 focus-within:ring-${mode === 'image' ? 'dept-creative' : 'purple-500'}/20 transition-all z-10 p-2`}>
                <div className="pt-2 pl-1 text-muted-foreground flex-shrink-0">
                    {mode === 'image' ? <ImageIcon size={16} /> : <Video size={16} />}
                </div>
                <textarea
                    ref={textareaRef}
                    data-testid="direct-prompt-input"
                    value={prompt}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (!disabled && prompt.trim()) {
                                onGenerate();
                            }
                        }
                    }}
                    placeholder={mode === 'image' ? "Describe your image..." : "Describe your video... (Be detailed about cinematic motion, subjects, and style)"}
                    disabled={disabled}
                    className="flex-1 bg-transparent border-none text-sm px-2 py-2 focus:outline-none resize-none min-h-[44px] max-h-[200px]"
                    rows={1}
                />
                {children && (
                    <div className="flex items-center gap-2 pr-2 pt-1 flex-shrink-0">
                        {children}
                    </div>
                )}
            </div>
        </div>
    );
}
