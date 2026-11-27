import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Brain, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import type { ConversationSession } from '@/core/store/slices/agent/agentSessionSlice';
import type { AlwaysOnMemory, AlwaysOnMemoryCategory } from '@/types/AlwaysOnMemory';
import type { VaultCategory } from '@/services/agent/memory/CoreVaultService';
import { alwaysOnMemoryEngine } from '@/services/agent/memory/AlwaysOnMemoryEngine';
import { useToast } from '@/core/context/ToastContext';
import { cn } from '@/lib/utils';

export interface MeetingRoomMemoryPanelProps {
    room: ConversationSession;
}

const MEMORY_CATEGORIES: AlwaysOnMemoryCategory[] = [
    'creative',
    'business',
    'technical',
    'goal',
    'fact',
    'preference',
    'context',
];

const VAULT_PROMOTION_OPTIONS: Array<{ value: '' | VaultCategory; label: string }> = [
    { value: '', label: 'Global Recall Only' },
    { value: 'artist_identity', label: 'CORE Vault: Artist Identity' },
    { value: 'goals', label: 'CORE Vault: Goals' },
    { value: 'business_model', label: 'CORE Vault: Business Model' },
    { value: 'legal', label: 'CORE Vault: Legal' },
    { value: 'financial', label: 'CORE Vault: Financial' },
    { value: 'technical', label: 'CORE Vault: Technical' },
    { value: 'preferences', label: 'CORE Vault: Preferences' },
    { value: 'distribution', label: 'CORE Vault: Distribution' },
];

export function MeetingRoomMemoryPanel({ room }: MeetingRoomMemoryPanelProps) {
    const toast = useToast();
    const [memoryState, setMemoryState] = useState<{ roomId: string; items: AlwaysOnMemory[] }>({
        roomId: room.id,
        items: [],
    });
    const [loading, setLoading] = useState(false);
    const [extracting, setExtracting] = useState(false);
    const [newMemoryText, setNewMemoryText] = useState('');
    const [newCategory, setNewCategory] = useState<AlwaysOnMemoryCategory>('creative');
    const [vaultSelections, setVaultSelections] = useState<Record<string, '' | VaultCategory>>({});
    const requestIdRef = useRef(0);

    const memories = memoryState.roomId === room.id ? memoryState.items : [];
    const toastRef = useRef(toast);

    useEffect(() => {
        toastRef.current = toast;
    }, [toast]);

    const loadMemories = useCallback(async () => {
        const reqId = ++requestIdRef.current;
        const targetRoomId = room.id;
        setLoading(true);
        try {
            const items = await alwaysOnMemoryEngine.getRoomMemories(targetRoomId, 50);
            if (reqId === requestIdRef.current) {
                setMemoryState({ roomId: targetRoomId, items });
            }
        } catch {
            if (reqId === requestIdRef.current) {
                toastRef.current.error('Could not load room memories.');
            }
        } finally {
            if (reqId === requestIdRef.current) {
                setLoading(false);
            }
        }
    }, [room.id]);

    useEffect(() => {
        void loadMemories();
    }, [loadMemories]);

    const handleAddMemory = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = newMemoryText.trim();
        if (!trimmed) return;
        try {
            const receipt = await alwaysOnMemoryEngine.addRoomMemory(
                room.id,
                room.projectId,
                trimmed,
                newCategory
            );
            if (receipt.status === 'stored') {
                toast.success('Pinned memory to this room.');
                setNewMemoryText('');
                await loadMemories();
            } else {
                toast.error(receipt.reason);
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to save room memory.');
        }
    };

    const handleExtractFromChat = async () => {
        const recent = (room.messages ?? [])
            .slice(-20)
            .map(m => ({ role: m.role, text: typeof m.text === 'string' ? m.text : '' }))
            .filter(m => m.text.trim().length > 0);
        if (recent.length === 0) {
            toast.error('No messages in this room to extract memories from.');
            return;
        }
        setExtracting(true);
        try {
            const memoryScope = room.meetingRoom?.isolateMemory !== false ? 'room' : 'global';
            const count = await alwaysOnMemoryEngine.ingestFromSession(recent, room.id, {
                projectId: room.projectId,
                memoryScope,
            });
            toast.success(`Extracted ${count} memory item(s) for this room.`);
            await loadMemories();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Memory extraction failed.');
        } finally {
            setExtracting(false);
        }
    };

    const handlePromote = async (memoryId: string) => {
        const chosenVault = vaultSelections[memoryId] || undefined;
        try {
            const result = await alwaysOnMemoryEngine.promoteRoomMemoryToGlobal(memoryId, {
                writeToVaultCategory: chosenVault,
            });
            if (result.promoted) {
                toast.success(
                    chosenVault
                        ? `Promoted to global memory & CORE Vault (${chosenVault}).`
                        : 'Promoted to global long-term memory.'
                );
                await loadMemories();
            } else {
                toast.error(result.reason || 'Memory could not be promoted.');
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Promotion failed.');
        }
    };

    const handleDelete = async (memoryId: string) => {
        try {
            await alwaysOnMemoryEngine.deleteMemory(memoryId);
            setMemoryState(prev => (
                prev.roomId === room.id
                    ? { roomId: prev.roomId, items: prev.items.filter(m => m.id !== memoryId) }
                    : prev
            ));
            toast.success('Deleted room memory.');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Delete failed.');
        }
    };

    return (
        <div data-testid="meeting-room-memory-panel" className="h-full flex flex-col bg-zinc-950 text-white min-h-0 overflow-hidden">
            {/* Header & Actions */}
            <div className="px-4 py-3 border-b border-white/10 bg-black/40 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                    <Brain size={15} className="text-indigo-400 shrink-0" />
                    <div className="min-w-0">
                        <h3 className="text-xs font-bold truncate">Room Long-Term Memory</h3>
                        <p className="text-[10px] text-white/40 truncate">
                            {room.meetingRoom?.isolateMemory !== false
                                ? 'Isolated to this room until promoted'
                                : 'Shared with global memory'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <button
                        type="button"
                        onClick={() => void handleExtractFromChat()}
                        disabled={extracting}
                        data-testid="extract-room-memory-btn"
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600/25 hover:bg-indigo-600/40 border border-indigo-400/40 text-[11px] font-bold text-indigo-200 disabled:opacity-50"
                    >
                        <Sparkles size={11} />
                        <span>{extracting ? 'Extracting…' : 'Extract'}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => void loadMemories()}
                        disabled={loading}
                        aria-label="Refresh room memories"
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white"
                    >
                        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Pin New Memory Form */}
            <form onSubmit={handleAddMemory} className="p-3 border-b border-white/10 bg-white/[0.02] space-y-2 shrink-0">
                <textarea
                    rows={2}
                    value={newMemoryText}
                    onChange={(e) => setNewMemoryText(e.target.value)}
                    placeholder="Pin a room decision, constraint, or creative canon..."
                    data-testid="add-room-memory-input"
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-400"
                />
                <div className="flex items-center justify-between gap-2">
                    <select
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value as AlwaysOnMemoryCategory)}
                        aria-label="Memory category"
                        className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white/80"
                    >
                        {MEMORY_CATEGORIES.map(cat => (
                            <option key={cat} value={cat} className="bg-zinc-900">
                                {cat}
                            </option>
                        ))}
                    </select>
                    <button
                        type="submit"
                        disabled={!newMemoryText.trim()}
                        data-testid="add-room-memory-submit"
                        className="flex items-center gap-1 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-[11px] font-bold text-white"
                    >
                        <Plus size={12} />
                        <span>Pin to Room</span>
                    </button>
                </div>
            </form>

            {/* Memories List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2.5">
                {memories.length === 0 ? (
                    <p className="text-xs text-white/40 text-center py-8 italic">
                        {loading ? 'Loading room memories…' : 'No room memories stored yet.'}
                    </p>
                ) : (
                    memories.map(mem => {
                        const isPromoted = mem.memoryScope !== 'room' || mem.promotedToGlobal === true;
                        return (
                            <div
                                key={mem.id}
                                data-testid={`room-memory-card-${mem.id}`}
                                className="p-3 rounded-xl bg-white/[0.04] border border-white/10 space-y-2"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-semibold text-white/80">
                                            {mem.category}
                                        </span>
                                        <span className={cn(
                                            'px-1.5 py-0.5 rounded text-[10px] font-bold',
                                            isPromoted
                                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                        )}>
                                            {isPromoted ? 'Promoted to Global' : 'Room-Only'}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => void handleDelete(mem.id)}
                                        aria-label={`Delete memory ${mem.id}`}
                                        className="p-1 rounded text-white/40 hover:text-red-400 hover:bg-white/5"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>

                                <p className="text-xs text-white/85 leading-relaxed">
                                    {mem.summary || mem.content}
                                </p>

                                {!isPromoted && (
                                    <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                                        <select
                                            value={vaultSelections[mem.id] ?? ''}
                                            onChange={(e) => setVaultSelections(prev => ({
                                                ...prev,
                                                [mem.id]: e.target.value as '' | VaultCategory,
                                            }))}
                                            aria-label="Promotion target"
                                            className="flex-1 px-2 py-1 rounded-lg bg-black/50 border border-white/10 text-[10px] text-white/75"
                                        >
                                            {VAULT_PROMOTION_OPTIONS.map(opt => (
                                                <option key={opt.value || 'global'} value={opt.value} className="bg-zinc-900">
                                                    {opt.label}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => void handlePromote(mem.id)}
                                            data-testid={`promote-memory-btn-${mem.id}`}
                                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600/25 hover:bg-emerald-600/40 border border-emerald-500/40 text-[10px] font-bold text-emerald-200 shrink-0"
                                        >
                                            <ArrowUpRight size={11} />
                                            <span>Promote</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
