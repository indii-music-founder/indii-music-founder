import React, { memo } from 'react';
import { Image, Paperclip, X } from 'lucide-react';

interface AttachmentListProps {
    attachments: File[];
    onRemove: (index: number) => void;
}

export const AttachmentList = memo(({ attachments, onRemove }: AttachmentListProps) => {
    if (attachments.length === 0) return null;
    return (
        <div className="px-4 pb-2 flex gap-2 flex-wrap">
            {attachments.map((file, index) => (
                <div key={index} className="flex items-center gap-2 bg-white/5 px-2 py-1 rounded text-xs text-gray-300 border border-white/10">
                    {file.type.startsWith('image/') ? <Image size={12} /> : <Paperclip size={12} />}
                    <span className="max-w-[150px] truncate">{file.name}</span>
                    <button
                        type="button"
                        onClick={() => onRemove(index)}
                        className="hover:text-white p-1 hover:bg-white/10 rounded-full transition-colors"
                        aria-label={`Remove ${file.name}`}
                    >
                        <X size={12} />
                    </button>
                </div>
            ))}
        </div>
    );
});
