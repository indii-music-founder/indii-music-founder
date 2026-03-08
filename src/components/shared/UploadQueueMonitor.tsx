import React from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { X, CheckCircle, AlertCircle, Loader2, FileImage, FileVideo, FileAudio, FileText, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

export const UploadQueueMonitor: React.FC = () => {
    const {
        uploadQueue,
        isUploadQueueOpen,
        toggleUploadQueue,
        removeUploadItem,
        clearCompletedUploads
    } = useStore(useShallow(state => ({
        uploadQueue: state.uploadQueue,
        isUploadQueueOpen: state.isUploadQueueOpen,
        toggleUploadQueue: state.toggleUploadQueue,
        removeUploadItem: state.removeUploadItem,
        clearCompletedUploads: state.clearCompletedUploads,
    })));

    if (!uploadQueue || uploadQueue.length === 0) return null;

    const inProgressCount = uploadQueue.filter(i => i.status === 'pending' || i.status === 'uploading').length;
    const completedCount = uploadQueue.filter(i => i.status === 'success').length;
    const errorCount = uploadQueue.filter(i => i.status === 'error').length;

    const getIconForType = (type: string) => {
        switch (type) {
            case 'image': return <FileImage size={16} className="text-blue-400" />;
            case 'video': return <FileVideo size={16} className="text-purple-400" />;
            case 'music': return <FileAudio size={16} className="text-orange-400" />;
            case 'document': return <FileText size={16} className="text-green-400" />;
            default: return <FileText size={16} className="text-gray-400" />;
        }
    };

    return (
        <div className="fixed bottom-4 right-4 z-[9990] w-80 bg-[#1a1a1a] border border-gray-800 rounded-xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300">
            {/* Header */}
            <div
                className="flex items-center justify-between p-3 bg-[#252525] border-b border-gray-800 cursor-pointer hover:bg-[#2a2a2a] transition-colors"
                onClick={() => toggleUploadQueue()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleUploadQueue();
                    }
                }}
                aria-expanded={isUploadQueueOpen}
            >
                <div>
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        Upload Queue
                        {inProgressCount > 0 && (
                            <span className="bg-blue-500/20 text-blue-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                {inProgressCount} active
                            </span>
                        )}
                    </h3>
                    {(completedCount > 0 || errorCount > 0) && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                            {completedCount} success{errorCount > 0 ? `, ${errorCount} failed` : ''}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {isUploadQueueOpen ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronUp size={18} className="text-gray-400" />}
                </div>
            </div>

            {/* Body */}
            {isUploadQueueOpen && (
                <div className="flex flex-col max-h-80 overflow-y-auto custom-scrollbar">
                    {uploadQueue.length > 0 ? (
                        <div className="flex flex-col divide-y divide-gray-800">
                            {uploadQueue.map(item => (
                                <div key={item.id} className="p-3 flex items-start gap-3 hover:bg-[#222] transition-colors group">
                                    <div className="shrink-0 mt-0.5">
                                        {getIconForType(item.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <p className="text-xs font-medium text-gray-200 truncate pr-2 w-full">{item.fileName}</p>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); removeUploadItem(item.id); }}
                                                className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                aria-label="Remove item"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {item.status === 'uploading' && (
                                                <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-blue-500 rounded-full transition-all duration-300"
                                                        style={{ width: `${item.progress}%` }}
                                                    />
                                                </div>
                                            )}
                                            {item.status === 'error' && <p className="text-[10px] text-red-400 truncate w-full">{item.error || 'Upload failed'}</p>}
                                        </div>
                                    </div>
                                    <div className="shrink-0">
                                        {item.status === 'pending' && <p className="text-[10px] text-gray-500">Wait...</p>}
                                        {item.status === 'uploading' && <Loader2 size={14} className="text-blue-400 animate-spin" />}
                                        {item.status === 'success' && <CheckCircle size={14} className="text-green-500" />}
                                        {item.status === 'error' && <AlertCircle size={14} className="text-red-500" />}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center text-gray-500 text-xs">
                            No uploads in queue
                        </div>
                    )}

                    {/* Footer Actions */}
                    {completedCount > 0 && (
                        <div className="bg-[#1f1f1f] border-t border-gray-800 p-2 flex justify-end">
                            <button
                                onClick={clearCompletedUploads}
                                className="text-[10px] flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
                            >
                                <Trash2 size={12} />
                                Clear Completed
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
