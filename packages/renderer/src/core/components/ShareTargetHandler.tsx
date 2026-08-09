import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { openDB } from 'idb';
import { Loader2, Share2, FileIcon, ImageIcon, Music, X } from 'lucide-react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { logger } from '@/utils/logger';
import { normalizeExternalHttpUrl } from '@/utils/safeExternalUrl';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useGlobalShortcut } from '@/hooks/useGlobalShortcut';

interface SharedItem {
    id?: number;
    files: File[];
    title: string | null;
    text: string | null;
    url: string | null;
    timestamp: number;
}

export function ShareTargetHandler() {
    const [searchParams, setSearchParams] = useSearchParams();
    const {
        commandBarAttachments,
        commandBarInput,
        isAgentOpen,
        setCommandBarAttachments,
        setCommandBarInput,
        toggleAgentWindow,
    } = useStore(useShallow(state => ({
        commandBarAttachments: state.commandBarAttachments,
        commandBarInput: state.commandBarInput,
        isAgentOpen: state.isAgentOpen,
        setCommandBarAttachments: state.setCommandBarAttachments,
        setCommandBarInput: state.setCommandBarInput,
        toggleAgentWindow: state.toggleAgentWindow,
    })));

    const [isProcessing, setIsProcessing] = useState(false);
    const [sharedItem, setSharedItem] = useState<SharedItem | null>(null);
    const isShareAction = searchParams.get('action') === 'share-target';
    const dialogRef = useFocusTrap(isShareAction);

    useEffect(() => {
        if (!isShareAction) return;

        const loadSharedContent = async () => {
            setIsProcessing(true);
            try {
                const db = await openDB('indii-share-target', 1);
                const tx = db.transaction('shared-items', 'readwrite');
                const store = tx.objectStore('shared-items');

                // Get the most recent item
                const keys = await store.getAllKeys();
                if (keys.length > 0) {
                    const lastKey = keys[keys.length - 1]!;
                    const item = await store.get(lastKey) as SharedItem;

                    // Add ID for deletion later
                    item.id = Number(lastKey);
                    setSharedItem(item);

                    // Clean up processed item immediately (optional strategy, specific to this UX)
                    // Or keep it until user explicitly handles it
                }
            } catch (error: unknown) {
                logger.error('[ShareHandler] Failed to load content:', error);
            } finally {
                setIsProcessing(false);
            }
        };

        loadSharedContent();
    }, [isShareAction]);

    const handleDismiss = async () => {
        if (sharedItem?.id) {
            const db = await openDB('indii-share-target', 1);
            await db.delete('shared-items', sharedItem.id);
        }
        // Create new params object to remove 'action'
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('action');
        setSearchParams(newParams);
        setSharedItem(null);
    };

    useGlobalShortcut({
        id: 'share-target-dismiss',
        key: 'Escape',
        priority: 'modal',
        ignoreInput: true,
        handler: () => { void handleDismiss(); },
    }, [sharedItem, searchParams], isShareAction);

    const handleOpenInConductor = async () => {
        if (!sharedItem) return;

        const safeUrl = normalizeExternalHttpUrl(sharedItem.url);
        const sharedText = [
            sharedItem.title ? `Title: ${sharedItem.title}` : '',
            sharedItem.text ?? '',
            safeUrl ?? '',
        ].filter(Boolean).join('\n');
        const prompt = sharedText
            ? `Review this shared content:\n${sharedText}`
            : 'Review the attached shared files.';

        setCommandBarInput([commandBarInput.trim(), prompt].filter(Boolean).join('\n\n'));
        setCommandBarAttachments([...commandBarAttachments, ...sharedItem.files]);
        if (!isAgentOpen) toggleAgentWindow();
        await handleDismiss();
    };

    if (!isShareAction || (!isProcessing && !sharedItem)) return null;
    const safeSharedUrl = normalizeExternalHttpUrl(sharedItem?.url);

    return (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="share-target-title"
                className="bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl max-w-md w-full overflow-hidden"
            >
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white">
                        <Share2 size={18} className="text-dept-marketing" />
                        <h3 id="share-target-title" className="font-semibold text-sm">Incoming Share</h3>
                    </div>
                    <button onClick={handleDismiss} className="text-gray-400 hover:text-white">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6">
                    {isProcessing ? (
                        <div className="flex flex-col items-center gap-4 py-8">
                            <Loader2 size={32} className="animate-spin text-dept-marketing" />
                            <p className="text-gray-400 text-sm">Processing shared content...</p>
                        </div>
                    ) : sharedItem ? (
                        <div className="space-y-6">
                            {/* Content Preview */}
                            <div className="bg-black/30 rounded-lg p-3 border border-white/5">
                                {sharedItem.title && (
                                    <h4 className="font-medium text-white mb-1">{sharedItem.title}</h4>
                                )}
                                {sharedItem.text && (
                                    <p className="text-sm text-gray-400 mb-2">{sharedItem.text}</p>
                                )}
                                {safeSharedUrl && (
                                    <a href={safeSharedUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 underline block mb-2 truncate">
                                        {safeSharedUrl}
                                    </a>
                                )}

                                {sharedItem.files && sharedItem.files.length > 0 && (
                                    <div className="mt-3 space-y-2">
                                        <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Attachments ({sharedItem.files.length})</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {sharedItem.files.map((file, idx) => (
                                                <div key={idx} className="flex items-center gap-2 bg-white/5 p-2 rounded overflow-hidden">
                                                    {file.type.startsWith('image/') ? <ImageIcon size={14} className="text-green-400 shrink-0" /> :
                                                        file.type.startsWith('audio/') ? <Music size={14} className="text-green-400 shrink-0" /> :
                                                            <FileIcon size={14} className="text-gray-400 shrink-0" />}
                                                    <span className="text-xs text-gray-300 truncate">{file.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Action */}
                            <div className="grid grid-cols-1 gap-3">
                                <p className="text-xs text-center text-gray-500">Open the received text and files as a real Conductor draft.</p>
                                <button
                                    onClick={() => void handleOpenInConductor()}
                                    className="flex items-center justify-center gap-2 p-3 bg-dept-marketing/10 hover:bg-dept-marketing/20 text-dept-marketing border border-dept-marketing/30 rounded-lg transition-colors"
                                >
                                    <Share2 size={16} />
                                    <span className="text-sm font-medium">Open in Conductor</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-gray-400">
                            No content found.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
