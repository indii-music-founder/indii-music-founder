import React, { useState } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { X, RotateCw, Trash2, Save, Layers } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { DesignVersion } from '@/core/store';

export default function DesignHistoryDrawer({ onClose }: { onClose: () => void }) {
    const { designVersions, saveDesignVersion, restoreDesignVersion, deleteDesignVersion } = useStore(useShallow(state => ({
        designVersions: state.designVersions,
        saveDesignVersion: state.saveDesignVersion,
        restoreDesignVersion: state.restoreDesignVersion,
        deleteDesignVersion: state.deleteDesignVersion
    })));
    
    const [isSaving, setIsSaving] = useState(false);
    const toast = useToast();

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await saveDesignVersion();
            toast.success("Design version saved!");
        } catch (err) {
            toast.error("Failed to save version");
        } finally {
            setIsSaving(false);
        }
    };

    const handleRestore = (version: DesignVersion) => {
        restoreDesignVersion(version);
        toast.success(`Restored: ${version.name}`);
        onClose();
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm("Are you sure you want to delete this version?")) {
            await deleteDesignVersion(id);
            toast.success("Version deleted");
        }
    };

    return (
        <div className="absolute top-full right-0 mt-2 mr-2 w-80 bg-[#0f0f0f]/95 backdrop-blur-xl border border-white/10 rounded-xl z-50 flex flex-col max-h-[80vh] overflow-hidden shadow-2xl animate-in slide-in-from-top-2 fade-in duration-200">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Layers size={16} className="text-emerald-400" />
                    Design Versions
                </h3>
                <button onClick={onClose} aria-label="Close design history" className="p-1 hover:bg-white/10 rounded-full text-gray-500 hover:text-white transition-colors">
                    <X size={18} />
                </button>
            </div>

            <div className="p-3 border-b border-white/5">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                >
                    <Save size={14} />
                    {isSaving ? "Saving..." : "Save Current Design"}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-3 pb-6">
                {designVersions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-500 text-xs">
                        <Layers size={32} className="mb-2 opacity-10" />
                        No saved versions
                    </div>
                ) : (
                    designVersions.map((v) => (
                        <div 
                            key={v.id} 
                            onClick={() => handleRestore(v)}
                            className="p-4 bg-white/5 border border-white/5 rounded-xl hover:border-emerald-500/30 transition-all group relative cursor-pointer"
                        >
                            <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => handleDelete(v.id, e)}
                                    className="p-1.5 bg-black/40 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400 transition-colors"
                                    title="Delete Version"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>

                            <h4 className="text-xs font-bold text-gray-200 mb-1 line-clamp-1">{v.name}</h4>
                            <p className="text-[10px] text-gray-500 font-mono italic mb-3">
                                {new Date(v.createdAt).toLocaleString()}
                            </p>

                            <div className="flex items-center justify-between">
                                <span className="text-[8px] text-gray-600 font-mono uppercase tracking-widest">
                                    {v.state.canvasImages?.length || 0} Layers
                                </span>
                                <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold uppercase">
                                    <RotateCw size={10} /> Revert
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
