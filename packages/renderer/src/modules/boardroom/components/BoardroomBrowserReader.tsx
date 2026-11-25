import React from 'react';
import { Globe } from 'lucide-react';

interface BoardroomBrowserReaderProps {
    pageTitle: string | null;
    committedUrl: string;
    extractedText: string | null;
    onBackToFrame: () => void;
}

export function BoardroomBrowserReader({
    pageTitle,
    committedUrl,
    extractedText,
    onBackToFrame,
}: BoardroomBrowserReaderProps) {
    return (
        <div className="flex-1 w-full min-h-0 overflow-y-auto custom-scrollbar">
            <div className="p-6 text-white/80 space-y-4 max-w-3xl mx-auto">
                <div className="border-b border-white/10 pb-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="text-base font-bold text-white truncate">{pageTitle || committedUrl}</h2>
                        <p className="text-xs text-white/40 truncate mt-0.5">{committedUrl}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onBackToFrame}
                        className="px-3 py-1 text-xs bg-white/10 hover:bg-white/15 rounded-lg transition-colors shrink-0 whitespace-nowrap"
                    >
                        Back to Frame
                    </button>
                </div>
                <div className="prose prose-invert prose-sm leading-relaxed whitespace-pre-wrap font-sans text-xs">
                    {extractedText || (
                        <div className="text-center py-8 text-white/40">
                            <Globe size={24} className="mx-auto mb-2 opacity-30" />
                            <p>Extracting readable text from webpage...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
