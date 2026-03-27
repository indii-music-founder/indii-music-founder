import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Brain,
    Search,
    Zap,
    Trash2,
    MessageSquare,
    Plus,
    RefreshCw,
    Sparkles,
    Layers,
    Filter,
    ChevronDown,
    Clock,
    Tag,
    TrendingUp,
    Archive,
    AlertCircle,
    CheckCircle,
    X,
    Send,
    FileText,
    Image,
    Music,
    Video,
    BookOpen,
    Activity,
    Database,
    Lightbulb,
} from 'lucide-react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { auth } from '@/services/firebase';
import type { AlwaysOnMemory, AlwaysOnMemoryCategory, MemoryTier } from '@/types/AlwaysOnMemory';

// ============================================================================
// CONSTANTS
// ============================================================================

const CATEGORY_ICONS: Record<AlwaysOnMemoryCategory, typeof Brain> = {
    preference: Sparkles,
    fact: BookOpen,
    context: Layers,
    goal: TrendingUp,
    skill: Zap,
    interaction: MessageSquare,
    feedback: AlertCircle,
    relationship: Brain,
    creative: Image,
    business: Activity,
    technical: Database,
    insight: Lightbulb,
};

const CATEGORY_COLORS: Record<AlwaysOnMemoryCategory, string> = {
    preference: '#a78bfa',
    fact: '#60a5fa',
    context: '#34d399',
    goal: '#fbbf24',
    skill: '#f472b6',
    interaction: '#818cf8',
    feedback: '#fb923c',
    relationship: '#c084fc',
    creative: '#f87171',
    business: '#4ade80',
    technical: '#22d3ee',
    insight: '#e879f9',
};

const TIER_LABELS: Record<MemoryTier, { label: string; color: string }> = {
    working: { label: 'Working', color: '#60a5fa' },
    shortTerm: { label: 'Short-Term', color: '#fbbf24' },
    longTerm: { label: 'Long-Term', color: '#34d399' },
    archived: { label: 'Archived', color: '#6b7280' },
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const MemoryCard: React.FC<{
    memory: AlwaysOnMemory;
    isSelected: boolean;
    onSelect: () => void;
    onDelete: () => void;
}> = ({ memory, isSelected, onSelect, onDelete }) => {
    const Icon = CATEGORY_ICONS[memory.category] || Brain;
    const categoryColor = CATEGORY_COLORS[memory.category] || '#60a5fa';
    const tierInfo = TIER_LABELS[memory.tier] || TIER_LABELS.working;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onClick={onSelect}
            className={`memory-card ${isSelected ? 'selected' : ''}`}
            style={{
                padding: '14px 16px',
                borderRadius: 12,
                background: isSelected
                    ? 'rgba(124, 58, 237, 0.12)'
                    : 'rgba(255, 255, 255, 0.03)',
                border: isSelected
                    ? '1px solid rgba(124, 58, 237, 0.4)'
                    : '1px solid rgba(255, 255, 255, 0.06)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                marginBottom: 8,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: `${categoryColor}22`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                    }}
                >
                    <Icon size={16} color={categoryColor} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontSize: 13,
                        color: 'rgba(255,255,255,0.9)',
                        lineHeight: 1.5,
                        marginBottom: 8,
                        wordBreak: 'break-word',
                    }}>
                        {memory.summary || memory.content}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {/* Category pill */}
                        <span style={{
                            fontSize: 10,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            color: categoryColor,
                            background: `${categoryColor}15`,
                            padding: '2px 8px',
                            borderRadius: 6,
                        }}>
                            {memory.category}
                        </span>

                        {/* Tier pill */}
                        <span style={{
                            fontSize: 10,
                            fontWeight: 500,
                            color: tierInfo.color,
                            background: `${tierInfo.color}15`,
                            padding: '2px 8px',
                            borderRadius: 6,
                        }}>
                            {tierInfo.label}
                        </span>

                        {/* Importance bar */}
                        <div style={{
                            width: 40,
                            height: 4,
                            borderRadius: 2,
                            background: 'rgba(255,255,255,0.08)',
                            overflow: 'hidden',
                        }}>
                            <div style={{
                                width: `${(memory.importance || 0.5) * 100}%`,
                                height: '100%',
                                borderRadius: 2,
                                background: `linear-gradient(90deg, ${categoryColor}, ${categoryColor}88)`,
                            }} />
                        </div>

                        {/* Topics */}
                        {(memory.topics || []).slice(0, 2).map((topic, i) => (
                            <span key={i} style={{
                                fontSize: 10,
                                color: 'rgba(255,255,255,0.4)',
                                background: 'rgba(255,255,255,0.05)',
                                padding: '2px 6px',
                                borderRadius: 4,
                            }}>
                                #{topic}
                            </span>
                        ))}

                        {/* Time */}
                        <span style={{
                            fontSize: 10,
                            color: 'rgba(255,255,255,0.3)',
                            marginLeft: 'auto',
                        }}>
                            {memory.createdAt?.toDate
                                ? formatTimeAgo(memory.createdAt.toDate())
                                : ''}
                        </span>
                    </div>
                </div>

                {/* Delete button */}
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 4,
                        color: 'rgba(255,255,255,0.2)',
                        transition: 'color 0.2s',
                        flexShrink: 0,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </motion.div>
    );
};

const InsightCard: React.FC<{ insight: { id?: string; insight?: string; summary?: string } }> = ({ insight }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{
            padding: '14px 16px',
            borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08), rgba(59, 130, 246, 0.08))',
            border: '1px solid rgba(168, 85, 247, 0.15)',
            marginBottom: 8,
        }}
    >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Lightbulb size={14} color="#e879f9" />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#e879f9', letterSpacing: '0.03em' }}>
                INSIGHT
            </span>
        </div>
        <p style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.85)',
            lineHeight: 1.6,
            margin: 0,
        }}>
            {insight.insight}
        </p>
        <p style={{
            fontSize: 12,
            color: 'rgba(255,255,255,0.4)',
            lineHeight: 1.5,
            margin: '6px 0 0',
        }}>
            {insight.summary}
        </p>
    </motion.div>
);

const StatCard: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: string | number;
    color: string;
}> = ({ icon, label, value, color }) => (
    <div style={{
        padding: '14px 16px',
        borderRadius: 12,
        background: `${color}08`,
        border: `1px solid ${color}20`,
        flex: 1,
        minWidth: 100,
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            {icon}
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {label}
            </span>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color, letterSpacing: '-0.02em' }}>
            {value}
        </div>
    </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const MemoryDashboard: React.FC = () => {
    const {
        alwaysOnMemories: memories,
        alwaysOnInsights: insights,
        alwaysOnEngineStatus: status,
        isMemoryDashboardOpen,
        memorySearchQuery,
        memoryFilterCategory,
        memoryFilterTier,
        selectedMemoryId,
        setMemoryDashboardOpen,
        setMemorySearchQuery,
        setMemoryFilterCategory,
        setMemoryFilterTier,
        setSelectedMemoryId,
        loadAlwaysOnMemories,
        loadAlwaysOnInsights,
        refreshAlwaysOnEngineStatus,
        startMemoryEngine,
        stopMemoryEngine,
        ingestMemoryText,
        triggerMemoryConsolidation,
        deleteAlwaysOnMemory,
        queryAlwaysOnMemory,
    } = useStore(useShallow((s) => ({
        alwaysOnMemories: s.alwaysOnMemories || [],
        alwaysOnInsights: s.alwaysOnInsights || [],
        alwaysOnEngineStatus: s.alwaysOnEngineStatus || {},
        isMemoryDashboardOpen: s.isMemoryDashboardOpen || false,
        memorySearchQuery: s.memorySearchQuery || '',
        memoryFilterCategory: s.memoryFilterCategory || 'all',
        memoryFilterTier: s.memoryFilterTier || 'all',
        selectedMemoryId: s.selectedMemoryId || null,
        setMemoryDashboardOpen: s.setMemoryDashboardOpen,
        setMemorySearchQuery: s.setMemorySearchQuery,
        setMemoryFilterCategory: s.setMemoryFilterCategory,
        setMemoryFilterTier: s.setMemoryFilterTier,
        setSelectedMemoryId: s.setSelectedMemoryId,
        loadAlwaysOnMemories: s.loadAlwaysOnMemories,
        loadAlwaysOnInsights: s.loadAlwaysOnInsights,
        refreshAlwaysOnEngineStatus: s.refreshAlwaysOnEngineStatus,
        startMemoryEngine: s.startMemoryEngine,
        stopMemoryEngine: s.stopMemoryEngine,
        ingestMemoryText: s.ingestMemoryText,
        triggerMemoryConsolidation: s.triggerMemoryConsolidation,
        deleteAlwaysOnMemory: s.deleteAlwaysOnMemory,
        queryAlwaysOnMemory: s.queryAlwaysOnMemory,
    })));

    const [ingestInput, setIngestInput] = useState('');
    const [queryInput, setQueryInput] = useState('');
    const [queryResult, setQueryResult] = useState('');
    const [isQuerying, setIsQuerying] = useState(false);
    const [isConsolidating, setIsConsolidating] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [activeTab, setActiveTab] = useState<'memories' | 'insights' | 'query'>('memories');
    const ingestRef = useRef<HTMLTextAreaElement>(null);

    // Load data on mount
    useEffect(() => {
        const userId = auth.currentUser?.uid;
        if (userId && isMemoryDashboardOpen) {
            loadAlwaysOnMemories?.(userId);
            loadAlwaysOnInsights?.(userId);
            refreshAlwaysOnEngineStatus?.(userId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMemoryDashboardOpen]);

    // Filter memories
    const filteredMemories = useMemo(() => {
        let filtered = memories || [];

        if (memorySearchQuery) {
            const q = memorySearchQuery.toLowerCase();
            filtered = filtered.filter((m: AlwaysOnMemory) =>
                (m.content || '').toLowerCase().includes(q) ||
                (m.summary || '').toLowerCase().includes(q) ||
                (m.topics || []).some((t: string) => t.toLowerCase().includes(q)) ||
                (m.entities || []).some((e: { name: string }) => e.name.toLowerCase().includes(q))
            );
        }

        if (memoryFilterCategory !== 'all') {
            filtered = filtered.filter((m: AlwaysOnMemory) => m.category === memoryFilterCategory);
        }

        if (memoryFilterTier !== 'all') {
            filtered = filtered.filter((m: AlwaysOnMemory) => m.tier === memoryFilterTier);
        }

        return filtered;
    }, [memories, memorySearchQuery, memoryFilterCategory, memoryFilterTier]);

    // Handlers
    const handleIngest = useCallback(async () => {
        const userId = auth.currentUser?.uid;
        if (!ingestInput.trim() || !ingestMemoryText || !userId) return;
        await ingestMemoryText(userId, ingestInput.trim());
        setIngestInput('');
    }, [ingestInput, ingestMemoryText]);

    const handleQuery = useCallback(async () => {
        const userId = auth.currentUser?.uid;
        if (!queryInput.trim() || !queryAlwaysOnMemory || !userId) return;
        setIsQuerying(true);
        try {
            const result = await queryAlwaysOnMemory(userId, queryInput.trim());
            setQueryResult(result);
        } finally {
            setIsQuerying(false);
        }
    }, [queryInput, queryAlwaysOnMemory]);

    const handleConsolidate = useCallback(async () => {
        const userId = auth.currentUser?.uid;
        if (!triggerMemoryConsolidation || !userId) return;
        setIsConsolidating(true);
        try {
            await triggerMemoryConsolidation(userId);
        } finally {
            setIsConsolidating(false);
        }
    }, [triggerMemoryConsolidation]);

    const handleStartEngine = useCallback(async () => {
        const userId = auth.currentUser?.uid;
        if (userId && startMemoryEngine) {
            await startMemoryEngine(userId);
        }
    }, [startMemoryEngine]);

    // Don't render if not open
    if (!isMemoryDashboardOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 9999,
                background: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(20px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
            }}
            onClick={() => setMemoryDashboardOpen?.(false)}
        >
            <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: '100%',
                    maxWidth: 960,
                    height: '85vh',
                    borderRadius: 20,
                    background: 'linear-gradient(180deg, rgba(15, 15, 25, 0.98), rgba(10, 10, 18, 0.99))',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 32px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                }}
            >
                {/* ============ HEADER ============ */}
                <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                }}>
                    <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        background: 'linear-gradient(135deg, #7c3aed, #3b82f6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <Brain size={20} color="white" />
                    </div>
                    <div style={{ flex: 1 }}>
                        <h2 style={{
                            margin: 0,
                            fontSize: 18,
                            fontWeight: 700,
                            color: 'white',
                            letterSpacing: '-0.02em',
                        }}>
                            Always-On Memory
                        </h2>
                        <p style={{
                            margin: 0,
                            fontSize: 12,
                            color: 'rgba(255,255,255,0.4)',
                        }}>
                            {status?.isRunning
                                ? `🟢 Running • ${status.totalMemories || 0} memories • ${status.unconsolidatedCount || 0} pending`
                                : '⚫ Engine stopped'}
                        </p>
                    </div>

                    {/* Engine toggle */}
                    {!status?.isRunning ? (
                        <button
                            onClick={handleStartEngine}
                            style={{
                                background: 'linear-gradient(135deg, #7c3aed, #3b82f6)',
                                border: 'none',
                                color: 'white',
                                padding: '8px 16px',
                                borderRadius: 8,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                            }}
                        >
                            <Zap size={14} /> Start Engine
                        </button>
                    ) : (
                        <button
                            onClick={handleConsolidate}
                            disabled={isConsolidating}
                            style={{
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: 'white',
                                padding: '8px 16px',
                                borderRadius: 8,
                                fontSize: 12,
                                fontWeight: 500,
                                cursor: isConsolidating ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                opacity: isConsolidating ? 0.5 : 1,
                            }}
                        >
                            <RefreshCw size={14} className={isConsolidating ? 'animate-spin' : ''} />
                            {isConsolidating ? 'Consolidating...' : 'Consolidate Now'}
                        </button>
                    )}

                    <button
                        onClick={() => setMemoryDashboardOpen?.(false)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'rgba(255,255,255,0.4)',
                            cursor: 'pointer',
                            padding: 4,
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* ============ STATS BAR ============ */}
                <div style={{
                    padding: '12px 24px',
                    display: 'flex',
                    gap: 10,
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}>
                    <StatCard
                        icon={<Database size={14} color="#60a5fa" />}
                        label="Total"
                        value={status?.totalMemories || 0}
                        color="#60a5fa"
                    />
                    <StatCard
                        icon={<Clock size={14} color="#fbbf24" />}
                        label="Pending"
                        value={status?.unconsolidatedCount || 0}
                        color="#fbbf24"
                    />
                    <StatCard
                        icon={<Lightbulb size={14} color="#e879f9" />}
                        label="Insights"
                        value={status?.totalInsights || 0}
                        color="#e879f9"
                    />
                    <StatCard
                        icon={<Layers size={14} color="#34d399" />}
                        label="Long-Term"
                        value={status?.memoriesByTier?.longTerm || 0}
                        color="#34d399"
                    />
                </div>

                {/* ============ TABS ============ */}
                <div style={{
                    padding: '0 24px',
                    display: 'flex',
                    gap: 2,
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}>
                    {(['memories', 'insights', 'query'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: activeTab === tab ? 'white' : 'rgba(255,255,255,0.4)',
                                fontSize: 13,
                                fontWeight: activeTab === tab ? 600 : 400,
                                padding: '12px 16px',
                                cursor: 'pointer',
                                borderBottom: activeTab === tab ? '2px solid #7c3aed' : '2px solid transparent',
                                textTransform: 'capitalize',
                                transition: 'all 0.2s',
                            }}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* ============ CONTENT ============ */}
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {/* Search & Filters (memories tab) */}
                    {activeTab === 'memories' && (
                        <div style={{ padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <div style={{
                                    flex: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    background: 'rgba(255,255,255,0.04)',
                                    borderRadius: 10,
                                    padding: '0 12px',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                }}>
                                    <Search size={14} color="rgba(255,255,255,0.3)" />
                                    <input
                                        type="text"
                                        value={memorySearchQuery}
                                        onChange={(e) => setMemorySearchQuery?.(e.target.value)}
                                        placeholder="Search memories..."
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            outline: 'none',
                                            color: 'white',
                                            fontSize: 13,
                                            width: '100%',
                                            padding: '10px 0',
                                        }}
                                    />
                                </div>
                                <button
                                    onClick={() => setShowFilters(!showFilters)}
                                    style={{
                                        background: showFilters ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)',
                                        border: showFilters ? '1px solid rgba(124,58,237,0.3)' : '1px solid rgba(255,255,255,0.06)',
                                        color: showFilters ? '#a78bfa' : 'rgba(255,255,255,0.5)',
                                        borderRadius: 10,
                                        padding: '0 12px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        fontSize: 12,
                                    }}
                                >
                                    <Filter size={14} /> Filters
                                </button>
                            </div>

                            {showFilters && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    style={{ overflow: 'hidden', marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}
                                >
                                    {/* Category filter */}
                                    <select
                                        value={memoryFilterCategory}
                                        onChange={(e) => setMemoryFilterCategory?.(e.target.value as AlwaysOnMemoryCategory | 'all')}
                                        style={{
                                            background: 'rgba(255,255,255,0.06)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            color: 'white',
                                            borderRadius: 8,
                                            padding: '6px 12px',
                                            fontSize: 12,
                                            outline: 'none',
                                        }}
                                    >
                                        <option value="all">All Categories</option>
                                        {Object.keys(CATEGORY_COLORS).map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>

                                    {/* Tier filter */}
                                    <select
                                        value={memoryFilterTier}
                                        onChange={(e) => setMemoryFilterTier?.(e.target.value as MemoryTier | 'all')}
                                        style={{
                                            background: 'rgba(255,255,255,0.06)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            color: 'white',
                                            borderRadius: 8,
                                            padding: '6px 12px',
                                            fontSize: 12,
                                            outline: 'none',
                                        }}
                                    >
                                        <option value="all">All Tiers</option>
                                        {Object.entries(TIER_LABELS).map(([key, val]) => (
                                            <option key={key} value={key}>{val.label}</option>
                                        ))}
                                    </select>
                                </motion.div>
                            )}
                        </div>
                    )}

                    {/* Scrollable content */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 24px' }}>
                        {/* ---- MEMORIES TAB ---- */}
                        {activeTab === 'memories' && (
                            <>
                                {/* Ingest bar */}
                                <div style={{
                                    display: 'flex',
                                    gap: 8,
                                    marginBottom: 16,
                                }}>
                                    <textarea
                                        ref={ingestRef}
                                        value={ingestInput}
                                        onChange={(e) => setIngestInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleIngest();
                                            }
                                        }}
                                        placeholder="Remember something... (Enter to save)"
                                        rows={1}
                                        style={{
                                            flex: 1,
                                            background: 'rgba(255,255,255,0.04)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            borderRadius: 12,
                                            color: 'white',
                                            fontSize: 13,
                                            padding: '12px 14px',
                                            outline: 'none',
                                            resize: 'none',
                                            fontFamily: 'inherit',
                                        }}
                                    />
                                    <button
                                        onClick={handleIngest}
                                        disabled={!ingestInput.trim()}
                                        style={{
                                            background: ingestInput.trim()
                                                ? 'linear-gradient(135deg, #7c3aed, #3b82f6)'
                                                : 'rgba(255,255,255,0.04)',
                                            border: 'none',
                                            color: 'white',
                                            borderRadius: 12,
                                            width: 44,
                                            cursor: ingestInput.trim() ? 'pointer' : 'not-allowed',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            opacity: ingestInput.trim() ? 1 : 0.4,
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        <Plus size={18} />
                                    </button>
                                </div>

                                {/* Memory list */}
                                <AnimatePresence>
                                    {filteredMemories.length === 0 ? (
                                        <div style={{
                                            textAlign: 'center',
                                            padding: '48px 24px',
                                            color: 'rgba(255,255,255,0.3)',
                                        }}>
                                            <Brain size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
                                            <p style={{ fontSize: 14, margin: 0 }}>
                                                {memories.length === 0
                                                    ? 'No memories yet. Start by typing something above.'
                                                    : 'No memories match your filters.'}
                                            </p>
                                        </div>
                                    ) : (
                                        filteredMemories.map((memory: AlwaysOnMemory) => (
                                            <MemoryCard
                                                key={memory.id}
                                                memory={memory}
                                                isSelected={selectedMemoryId === memory.id}
                                                onSelect={() => setSelectedMemoryId?.(
                                                    selectedMemoryId === memory.id ? null : memory.id
                                                )}
                                                onDelete={() => { const uid = auth.currentUser?.uid; if (uid) deleteAlwaysOnMemory?.(uid, memory.id); }}
                                            />
                                        ))
                                    )}
                                </AnimatePresence>
                            </>
                        )}

                        {/* ---- INSIGHTS TAB ---- */}
                        {activeTab === 'insights' && (
                            <>
                                {(insights || []).length === 0 ? (
                                    <div style={{
                                        textAlign: 'center',
                                        padding: '48px 24px',
                                        color: 'rgba(255,255,255,0.3)',
                                    }}>
                                        <Lightbulb size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
                                        <p style={{ fontSize: 14, margin: 0 }}>
                                            No insights yet. Consolidation will generate insights
                                            by finding connections across your memories.
                                        </p>
                                    </div>
                                ) : (
                                    (insights || []).map((insight: { id?: string; insight?: string; summary?: string }, i: number) => (
                                        <InsightCard key={insight.id || i} insight={insight} />
                                    ))
                                )}
                            </>
                        )}

                        {/* ---- QUERY TAB ---- */}
                        {activeTab === 'query' && (
                            <div>
                                <div style={{
                                    display: 'flex',
                                    gap: 8,
                                    marginBottom: 16,
                                }}>
                                    <input
                                        type="text"
                                        value={queryInput}
                                        onChange={(e) => setQueryInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleQuery();
                                        }}
                                        placeholder="Ask your memory anything..."
                                        style={{
                                            flex: 1,
                                            background: 'rgba(255,255,255,0.04)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            borderRadius: 12,
                                            color: 'white',
                                            fontSize: 13,
                                            padding: '12px 14px',
                                            outline: 'none',
                                            fontFamily: 'inherit',
                                        }}
                                    />
                                    <button
                                        onClick={handleQuery}
                                        disabled={!queryInput.trim() || isQuerying}
                                        style={{
                                            background: queryInput.trim()
                                                ? 'linear-gradient(135deg, #7c3aed, #3b82f6)'
                                                : 'rgba(255,255,255,0.04)',
                                            border: 'none',
                                            color: 'white',
                                            borderRadius: 12,
                                            width: 44,
                                            cursor: queryInput.trim() && !isQuerying ? 'pointer' : 'not-allowed',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            opacity: queryInput.trim() ? 1 : 0.4,
                                        }}
                                    >
                                        <Send size={16} />
                                    </button>
                                </div>

                                {isQuerying && (
                                    <div style={{
                                        padding: '24px',
                                        textAlign: 'center',
                                        color: 'rgba(255,255,255,0.4)',
                                    }}>
                                        <RefreshCw size={20} className="animate-spin" style={{ marginBottom: 8 }} />
                                        <p style={{ fontSize: 13, margin: 0 }}>Searching memories...</p>
                                    </div>
                                )}

                                {queryResult && !isQuerying && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        style={{
                                            padding: '16px 20px',
                                            borderRadius: 14,
                                            background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid rgba(255,255,255,0.06)',
                                        }}
                                    >
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            marginBottom: 12,
                                        }}>
                                            <Brain size={16} color="#a78bfa" />
                                            <span style={{
                                                fontSize: 12,
                                                fontWeight: 600,
                                                color: '#a78bfa',
                                            }}>
                                                Memory Response
                                            </span>
                                        </div>
                                        <div style={{
                                            fontSize: 13,
                                            color: 'rgba(255,255,255,0.85)',
                                            lineHeight: 1.7,
                                            whiteSpace: 'pre-wrap',
                                        }}>
                                            {queryResult}
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};

// ============================================================================
// UTILITY
// ============================================================================

function formatTimeAgo(date: Date): string {
    const now = Date.now();
    const diff = now - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
}

export default MemoryDashboard;
