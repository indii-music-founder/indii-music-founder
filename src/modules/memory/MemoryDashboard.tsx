/**
 * Memory Dashboard (Always-On Memory Agent)
 *
 * Main module component for browsing, querying, and managing the always-on memory system.
 * Provides a feed of memories, insight cards, ingest panel, query panel, and engine controls.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/core/store';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Brain,
    Search,
    Plus,
    Trash2,
    Zap,
    Loader2,
    MessageSquare,
    Tag,
    AlertCircle,
    Database,
    Sparkles,
    ChevronDown,
    FileText,
    X,
    ArrowRight,
    Clock,
    Link2,
    RefreshCw,
    Send,
    Upload,
} from 'lucide-react';
import type { AlwaysOnMemory, AlwaysOnMemoryCategory, MemoryTier } from '@/types/AlwaysOnMemory';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';

// ─── Constants ──────────────────────────────────────────────────

const TIER_LABELS: Record<MemoryTier, string> = {
    working: '⚡ Working',
    shortTerm: '📝 Short-Term',
    longTerm: '🧠 Long-Term',
    archived: '📦 Archived',
};

const TIER_COLORS: Record<MemoryTier, string> = {
    working: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    shortTerm: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    longTerm: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    archived: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const CATEGORY_LABELS: Partial<Record<AlwaysOnMemoryCategory | 'all', string>> = {
    all: 'All Categories',
    preference: '🎨 Preference',
    fact: '📄 Fact',
    creative: '✨ Creative',
    business: '💼 Business',
    technical: '⚙️ Technical',
    relationship: '🤝 Relationship',
    insight: '💡 Insight',
    goal: '🎯 Goal',
    context: '📌 Context',
    skill: '🛠️ Skill',
    interaction: '💬 Interaction',
    feedback: '📝 Feedback',
};

// ─── Component ──────────────────────────────────────────────────

export default function MemoryDashboard() {
    const {
        user,
        memories,
        insights,
        engineStatus,
        memorySearchQuery,
        memoryFilterCategory,
        memoryFilterTier,
        selectedMemoryId,
        setMemorySearchQuery,
        setMemoryFilterCategory,
        setMemoryFilterTier,
        setSelectedMemoryId,
        loadAlwaysOnMemories,
        loadAlwaysOnInsights,
        refreshAlwaysOnEngineStatus,
        ingestMemoryText,
        triggerMemoryConsolidation,
        deleteAlwaysOnMemory,
        queryAlwaysOnMemory,
        startMemoryEngine,
    } = useStore(
        useShallow((state) => ({
            user: state.user,
            memories: state.alwaysOnMemories,
            insights: state.alwaysOnInsights,
            engineStatus: state.alwaysOnEngineStatus,
            memorySearchQuery: state.memorySearchQuery,
            memoryFilterCategory: state.memoryFilterCategory,
            memoryFilterTier: state.memoryFilterTier,
            selectedMemoryId: state.selectedMemoryId,
            setMemorySearchQuery: state.setMemorySearchQuery,
            setMemoryFilterCategory: state.setMemoryFilterCategory,
            setMemoryFilterTier: state.setMemoryFilterTier,
            setSelectedMemoryId: state.setSelectedMemoryId,
            loadAlwaysOnMemories: state.loadAlwaysOnMemories,
            loadAlwaysOnInsights: state.loadAlwaysOnInsights,
            refreshAlwaysOnEngineStatus: state.refreshAlwaysOnEngineStatus,
            ingestMemoryText: state.ingestMemoryText,
            triggerMemoryConsolidation: state.triggerMemoryConsolidation,
            deleteAlwaysOnMemory: state.deleteAlwaysOnMemory,
            queryAlwaysOnMemory: state.queryAlwaysOnMemory,
            startMemoryEngine: state.startMemoryEngine,
        }))
    );

    const userId = user?.uid || '';

    // Local state
    const [ingestText, setIngestText] = useState('');
    const [queryText, setQueryText] = useState('');
    const [queryAnswer, setQueryAnswer] = useState('');
    const [isQuerying, setIsQuerying] = useState(false);
    const [isIngesting, setIsIngesting] = useState(false);
    const [isConsolidating, setIsConsolidating] = useState(false);
    const [activePanel, setActivePanel] = useState<'feed' | 'query' | 'ingest'>('feed');

    // Initial load
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (userId) {
            // Start engine if not running
            if (!engineStatus.isRunning) {
                startMemoryEngine(userId);
            }
            loadAlwaysOnMemories(userId);
            loadAlwaysOnInsights(userId);
            refreshAlwaysOnEngineStatus(userId);
        }
    }, [userId]);

    // Reload when filters change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (userId) {
            loadAlwaysOnMemories(userId);
        }
    }, [memoryFilterCategory, memoryFilterTier, memorySearchQuery, userId]);

    const selectedMemory = useMemo(
        () => memories.find((m) => m.id === selectedMemoryId),
        [memories, selectedMemoryId]
    );

    // ─── Handlers ───────────────────────────────────────────────

    const handleIngest = useCallback(async () => {
        if (!ingestText.trim() || !userId) return;
        setIsIngesting(true);
        try {
            await ingestMemoryText(userId, ingestText.trim());
            setIngestText('');
        } finally {
            setIsIngesting(false);
        }
    }, [ingestText, userId, ingestMemoryText]);

    const handleQuery = useCallback(async () => {
        if (!queryText.trim() || !userId) return;
        setIsQuerying(true);
        setQueryAnswer('');
        try {
            const answer = await queryAlwaysOnMemory(userId, queryText.trim());
            setQueryAnswer(answer);
        } finally {
            setIsQuerying(false);
        }
    }, [queryText, userId, queryAlwaysOnMemory]);

    const handleConsolidate = useCallback(async () => {
        if (!userId) return;
        setIsConsolidating(true);
        try {
            await triggerMemoryConsolidation(userId);
        } finally {
            setIsConsolidating(false);
        }
    }, [userId, triggerMemoryConsolidation]);

    const handleDelete = useCallback(
        async (memoryId: string) => {
            if (!userId) return;
            await deleteAlwaysOnMemory(userId, memoryId);
        },
        [userId, deleteAlwaysOnMemory]
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const handleRefresh = useCallback(() => {
        if (!userId) return;
        loadAlwaysOnMemories(userId);
        loadAlwaysOnInsights(userId);
        refreshAlwaysOnEngineStatus(userId);
    }, [userId]);

    const formatDate = (timestamp: any) => {
        if (!timestamp) return '—';
        const ms = typeof timestamp.toMillis === 'function' ? timestamp.toMillis() : timestamp;
        return new Date(ms).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // ─── Render ─────────────────────────────────────────────────

    return (
        <ModuleErrorBoundary moduleName="Memory">
        <div className="h-full flex flex-col bg-[#0d1117] text-white overflow-hidden" data-testid="memory-dashboard">
            {/* Header */}
            <div className="flex-shrink-0 border-b border-white/5 bg-[#0d1117]/80 backdrop-blur-xl">
                <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-purple-600/30 to-violet-600/30 border border-purple-500/20">
                            <Brain size={20} className="text-purple-400" />
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold tracking-tight">Memory Agent</h1>
                            <p className="text-xs text-gray-500">Always-On Persistent Memory System</p>
                        </div>
                    </div>

                    {/* Engine Status Badge */}
                    <div className="flex items-center gap-3">
                        <div
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${engineStatus.isRunning
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                                }`}
                        >
                            <span
                                className={`w-1.5 h-1.5 rounded-full ${engineStatus.isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
                                    }`}
                            />
                            {engineStatus.isRunning ? 'Running' : 'Stopped'}
                        </div>
                        <button
                            onClick={handleRefresh}
                            className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                            title="Refresh"
                        >
                            <RefreshCw size={14} />
                        </button>
                    </div>
                </div>

                {/* Stats Bar */}
                <div className="flex items-center gap-6 px-6 pb-3">
                    <StatBadge icon={Database} label="Memories" value={engineStatus.totalMemories} />
                    <StatBadge icon={Sparkles} label="Insights" value={engineStatus.totalInsights} />
                    <StatBadge icon={Zap} label="Unconsolidated" value={engineStatus.unconsolidatedCount} />
                    <div className="flex gap-2 ml-auto">
                        {(['feed', 'query', 'ingest'] as const).map((panel) => (
                            <button
                                key={panel}
                                onClick={() => setActivePanel(panel)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activePanel === panel
                                    ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                                    }`}
                            >
                                {panel === 'feed' ? '📋 Feed' : panel === 'query' ? '🔍 Query' : '📥 Ingest'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Panel — Feed / Query / Ingest */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {activePanel === 'feed' && (
                        <FeedPanel
                            memories={memories}
                            searchQuery={memorySearchQuery}
                            filterCategory={memoryFilterCategory}
                            filterTier={memoryFilterTier}
                            selectedMemoryId={selectedMemoryId}
                            onSearchChange={setMemorySearchQuery}
                            onFilterCategory={setMemoryFilterCategory}
                            onFilterTier={setMemoryFilterTier}
                            onSelect={setSelectedMemoryId}
                            onDelete={handleDelete}
                            onConsolidate={handleConsolidate}
                            isConsolidating={isConsolidating}
                            formatDate={formatDate}
                        />
                    )}
                    {activePanel === 'query' && (
                        <QueryPanel
                            queryText={queryText}
                            queryAnswer={queryAnswer}
                            isQuerying={isQuerying}
                            onQueryChange={setQueryText}
                            onSubmit={handleQuery}
                        />
                    )}
                    {activePanel === 'ingest' && (
                        <IngestPanel
                            ingestText={ingestText}
                            isIngesting={isIngesting}
                            onTextChange={setIngestText}
                            onSubmit={handleIngest}
                        />
                    )}
                </div>

                {/* Right Panel — Memory Detail / Insights */}
                <div className="w-[380px] border-l border-white/5 overflow-y-auto custom-scrollbar flex-shrink-0 hidden lg:block">
                    {selectedMemory ? (
                        <MemoryDetail
                            memory={selectedMemory}
                            formatDate={formatDate}
                            onClose={() => setSelectedMemoryId(null)}
                        />
                    ) : (
                        <InsightsPanel insights={insights} formatDate={formatDate} />
                    )}
                </div>
            </div>
        </div>
        </ModuleErrorBoundary>
    );
}

// ─── Sub-Components ─────────────────────────────────────────────

function StatBadge({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
    return (
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Icon size={12} />
            <span className="font-medium text-gray-300">{value}</span>
            <span>{label}</span>
        </div>
    );
}

// ─── Feed Panel ─────────────────────────────────────────────────

function FeedPanel({
    memories,
    searchQuery,
    filterCategory,
    filterTier,
    selectedMemoryId,
    onSearchChange,
    onFilterCategory,
    onFilterTier,
    onSelect,
    onDelete,
    onConsolidate,
    isConsolidating,
    formatDate,
}: {
    memories: AlwaysOnMemory[];
    searchQuery: string;
    filterCategory: AlwaysOnMemoryCategory | 'all';
    filterTier: MemoryTier | 'all';
    selectedMemoryId: string | null;
    onSearchChange: (q: string) => void;
    onFilterCategory: (c: AlwaysOnMemoryCategory | 'all') => void;
    onFilterTier: (t: MemoryTier | 'all') => void;
    onSelect: (id: string | null) => void;
    onDelete: (id: string) => void;
    onConsolidate: () => void;
    isConsolidating: boolean;
    formatDate: (t: any) => string;
}) {
    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search + Filters */}
            <div className="flex-shrink-0 px-4 py-3 border-b border-white/5 space-y-2">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            placeholder="Search memories..."
                            className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20"
                        />
                    </div>
                    <button
                        onClick={onConsolidate}
                        disabled={isConsolidating}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-600/20 text-purple-300 border border-purple-500/30 text-xs font-medium hover:bg-purple-600/30 transition-colors disabled:opacity-50"
                    >
                        {isConsolidating ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                        Consolidate
                    </button>
                </div>
                <div className="flex gap-2">
                    <select
                        value={filterCategory}
                        onChange={(e) => onFilterCategory(e.target.value as any)}
                        className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-300 focus:outline-none focus:border-purple-500/50"
                    >
                        {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                        ))}
                    </select>
                    <select
                        value={filterTier}
                        onChange={(e) => onFilterTier(e.target.value as any)}
                        className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-300 focus:outline-none focus:border-purple-500/50"
                    >
                        <option value="all">All Tiers</option>
                        {Object.entries(TIER_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Memory List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {memories.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
                        <Database size={32} className="opacity-30" />
                        <p className="text-sm">No memories yet</p>
                        <p className="text-xs">Ingest text or files to start building your memory graph.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        <AnimatePresence mode="popLayout">
                            {memories.map((m) => (
                                <motion.div
                                    key={m.id}
                                    layout
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -50 }}
                                    transition={{ duration: 0.2 }}
                                    onClick={() => onSelect(m.id === selectedMemoryId ? null : m.id)}
                                    className={`px-4 py-3 cursor-pointer transition-colors group ${m.id === selectedMemoryId
                                        ? 'bg-purple-500/5 border-l-2 border-l-purple-500'
                                        : 'hover:bg-white/[0.02] border-l-2 border-l-transparent'
                                        }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-gray-200 line-clamp-2">{m.summary || m.content}</p>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${TIER_COLORS[m.tier]}`}>
                                                    {TIER_LABELS[m.tier]}
                                                </span>
                                                <span className="text-[10px] text-gray-600">
                                                    {CATEGORY_LABELS[m.category] || m.category}
                                                </span>
                                                <span className="text-[10px] text-gray-600 flex items-center gap-1">
                                                    <Clock size={8} /> {formatDate(m.createdAt)}
                                                </span>
                                            </div>
                                            {m.topics.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1.5">
                                                    {m.topics.slice(0, 4).map((t) => (
                                                        <span key={t} className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-gray-500">
                                                            {t}
                                                        </span>
                                                    ))}
                                                    {m.topics.length > 4 && (
                                                        <span className="text-[10px] text-gray-600">+{m.topics.length - 4}</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDelete(m.id);
                                            }}
                                            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-gray-600 hover:text-red-400 transition-all"
                                            title="Delete memory"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Query Panel ────────────────────────────────────────────────

function QueryPanel({
    queryText,
    queryAnswer,
    isQuerying,
    onQueryChange,
    onSubmit,
}: {
    queryText: string;
    queryAnswer: string;
    isQuerying: boolean;
    onQueryChange: (q: string) => void;
    onSubmit: () => void;
}) {
    return (
        <div className="flex-1 flex flex-col p-6 gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                <MessageSquare size={14} />
                <span className="font-medium">Query Your Memory</span>
            </div>

            <div className="relative">
                <textarea
                    value={queryText}
                    onChange={(e) => onQueryChange(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            onSubmit();
                        }
                    }}
                    placeholder="Ask a question about your memories..."
                    rows={3}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 resize-none"
                />
                <button
                    onClick={onSubmit}
                    disabled={!queryText.trim() || isQuerying}
                    className="absolute bottom-3 right-3 p-2 rounded-lg bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {isQuerying ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
            </div>

            {queryAnswer && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex-1 overflow-y-auto bg-white/[0.02] border border-white/5 rounded-xl p-4"
                >
                    <div className="flex items-center gap-2 mb-3 text-xs text-purple-400 font-medium">
                        <Sparkles size={12} />
                        Answer
                    </div>
                    <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                        {queryAnswer}
                    </div>
                </motion.div>
            )}

            {!queryAnswer && !isQuerying && (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-600">
                    <Search size={40} className="opacity-20" />
                    <p className="text-sm">Ask anything about your stored memories</p>
                    <p className="text-xs text-gray-700">The AI will search, synthesize, and cite relevant memories.</p>
                </div>
            )}
        </div>
    );
}

// ─── Ingest Panel ───────────────────────────────────────────────

function IngestPanel({
    ingestText,
    isIngesting,
    onTextChange,
    onSubmit,
}: {
    ingestText: string;
    isIngesting: boolean;
    onTextChange: (t: string) => void;
    onSubmit: () => void;
}) {
    return (
        <div className="flex-1 flex flex-col p-6 gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                <Plus size={14} />
                <span className="font-medium">Ingest New Memory</span>
            </div>

            <textarea
                value={ingestText}
                onChange={(e) => onTextChange(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        onSubmit();
                    }
                }}
                placeholder="Paste text, notes, articles, or anything you want to remember..."
                rows={8}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 resize-none"
            />

            <div className="flex items-center justify-between">
                <p className="text-xs text-gray-600">
                    {ingestText.length > 0 ? `${ingestText.length} characters` : 'Ctrl+Enter to submit'}
                </p>
                <button
                    onClick={onSubmit}
                    disabled={!ingestText.trim() || isIngesting}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {isIngesting ? (
                        <>
                            <Loader2 size={14} className="animate-spin" />
                            Processing...
                        </>
                    ) : (
                        <>
                            <Upload size={14} />
                            Ingest Memory
                        </>
                    )}
                </button>
            </div>

            <div className="mt-4 p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <p className="text-xs text-gray-500 leading-relaxed">
                    <strong className="text-gray-400">How ingestion works:</strong> Your text is automatically analyzed
                    with Gemini to extract entities, assign topics, score importance, and generate a summary.
                    The structured memory is then stored in Firestore and can be queried or consolidated with other
                    memories to generate cross-cutting insights.
                </p>
            </div>
        </div>
    );
}

// ─── Memory Detail ──────────────────────────────────────────────

function MemoryDetail({
    memory,
    formatDate,
    onClose,
}: {
    memory: AlwaysOnMemory;
    formatDate: (t: any) => string;
    onClose: () => void;
}) {
    return (
        <div className="p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-200">Memory Detail</h3>
                <button onClick={onClose} className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-white transition-colors">
                    <X size={14} />
                </button>
            </div>

            <div className="space-y-4">
                {/* Summary */}
                <div>
                    <label className="text-[10px] uppercase text-gray-600 font-medium tracking-wider">Summary</label>
                    <p className="mt-1 text-sm text-gray-300 leading-relaxed">{memory.summary}</p>
                </div>

                {/* Raw Text */}
                {memory.rawText && memory.rawText !== memory.summary && (
                    <div>
                        <label className="text-[10px] uppercase text-gray-600 font-medium tracking-wider">Raw Text</label>
                        <p className="mt-1 text-xs text-gray-500 leading-relaxed max-h-40 overflow-y-auto custom-scrollbar">
                            {memory.rawText}
                        </p>
                    </div>
                )}

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-3">
                    <MetadataItem label="Tier" value={TIER_LABELS[memory.tier]} />
                    <MetadataItem label="Category" value={CATEGORY_LABELS[memory.category] || memory.category} />
                    <MetadataItem label="Importance" value={`${(memory.importance * 100).toFixed(0)}%`} />
                    <MetadataItem label="Access Count" value={String(memory.accessCount || 0)} />
                    <MetadataItem label="Created" value={formatDate(memory.createdAt)} />
                    <MetadataItem label="Consolidated" value={memory.consolidated ? '✅ Yes' : '❌ No'} />
                </div>

                {/* Entities */}
                {memory.entities?.length > 0 && (
                    <div>
                        <label className="text-[10px] uppercase text-gray-600 font-medium tracking-wider flex items-center gap-1">
                            <Tag size={10} /> Entities ({memory.entities.length})
                        </label>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {memory.entities.map((e, i) => (
                                <span
                                    key={i}
                                    className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px]"
                                >
                                    {e.name}
                                    <span className="text-blue-600 ml-1">({e.type})</span>
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Topics */}
                {memory.topics.length > 0 && (
                    <div>
                        <label className="text-[10px] uppercase text-gray-600 font-medium tracking-wider">Topics</label>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {memory.topics.map((t) => (
                                <span key={t} className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px]">
                                    {t}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Connections */}
                {memory.connections && memory.connections.length > 0 && (
                    <div>
                        <label className="text-[10px] uppercase text-gray-600 font-medium tracking-wider flex items-center gap-1">
                            <Link2 size={10} /> Connections ({memory.connections.length})
                        </label>
                        <div className="space-y-1 mt-1.5">
                            {memory.connections.map((conn, i) => (
                                <div key={i} className="flex items-center gap-2 text-[10px] text-gray-500">
                                    <ArrowRight size={10} />
                                    <span className="text-gray-400">{conn.relationship}</span>
                                    <span className="text-gray-600">({(conn.confidence * 100).toFixed(0)}%)</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Source */}
                {memory.source && (
                    <div>
                        <label className="text-[10px] uppercase text-gray-600 font-medium tracking-wider">Source</label>
                        <p className="mt-1 text-xs text-gray-500">
                            {memory.source}
                            {memory.sourceFileName && ` — ${memory.sourceFileName}`}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

function MetadataItem({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <span className="text-[10px] text-gray-600 block">{label}</span>
            <span className="text-xs text-gray-300 font-medium">{value}</span>
        </div>
    );
}

// ─── Insights Panel ─────────────────────────────────────────────

function InsightsPanel({
    insights,
    formatDate,
}: {
    insights: any[];
    formatDate: (t: any) => string;
}) {
    return (
        <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2 mb-4">
                <Sparkles size={14} className="text-purple-400" />
                Consolidation Insights
            </h3>

            {insights.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-600">
                    <Sparkles size={24} className="opacity-20" />
                    <p className="text-xs text-center">
                        No insights yet. Consolidation finds patterns<br />across your stored memories.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {insights.map((insight, i) => (
                        <motion.div
                            key={insight.id || i}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/10"
                        >
                            <p className="text-xs text-purple-300 leading-relaxed">{insight.insight}</p>
                            {insight.summary && (
                                <p className="text-[10px] text-gray-500 mt-2">{insight.summary}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-600">
                                {insight.confidence && (
                                    <span>Confidence: {(insight.confidence * 100).toFixed(0)}%</span>
                                )}
                                {insight.createdAt && <span>{formatDate(insight.createdAt)}</span>}
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}
