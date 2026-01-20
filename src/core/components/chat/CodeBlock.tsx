import React, { useState, useCallback } from 'react';
import { Check, Copy } from 'lucide-react';
import { getText } from './utils';
import { cn } from '@/lib/utils';

interface CodeBlockProps extends React.HTMLAttributes<HTMLPreElement> {
    children?: React.ReactNode;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ children, className, ...props }) => {
    const [isCopied, setIsCopied] = useState(false);

    const handleCopy = useCallback(async () => {
        const text = getText(children);
        if (!text) return;

        try {
            await navigator.clipboard.writeText(text);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    }, [children]);

    return (
        <div className="relative group/code my-2 rounded-lg border border-white/5 bg-black/30 overflow-hidden">
            {/* Header / Actions Area */}
            <div className="absolute right-2 top-2 z-10 opacity-0 group-hover/code:opacity-100 focus-within:opacity-100 transition-opacity">
                <button
                    onClick={handleCopy}
                    className={cn(
                        "flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all backdrop-blur-sm",
                        isCopied
                            ? "bg-green-500/20 text-green-400 border border-green-500/30"
                            : "bg-white/10 text-gray-400 hover:text-white hover:bg-white/20 border border-white/10"
                    )}
                    aria-label={isCopied ? "Copied to clipboard" : "Copy code to clipboard"}
                    title={isCopied ? "Copied!" : "Copy code"}
                    type="button"
                >
                    {isCopied ? (
                        <>
                            <Check size={14} />
                            <span>Copied!</span>
                        </>
                    ) : (
                        <>
                            <Copy size={14} />
                            <span>Copy</span>
                        </>
                    )}
                </button>
            </div>

            {/* Code Content */}
            <div className="overflow-x-auto custom-scrollbar">
                <pre {...props} className={cn("p-4 min-w-full pt-10", className)}>
                    {children}
                </pre>
            </div>
        </div>
    );
};
