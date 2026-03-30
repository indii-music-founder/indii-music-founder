import React from 'react';
import { motion } from 'framer-motion';
import {
    Brain,
    Sparkles,
    Layers,
    TrendingUp,
    Zap,
    MessageSquare,
    AlertCircle,
    Image,
    Activity,
    Database,
    Lightbulb,
    BookOpen,
    Trash2,
    Target,
    Server,
    Shield,
    CheckCircle,
    X,
    Clock
} from 'lucide-react';
import type { AlwaysOnMemory, AlwaysOnMemoryCategory, MemoryTier } from '@/types/AlwaysOnMemory';
import type { Directive } from '@/services/directive/DirectiveTypes';
import type { MemoryInboxItem } from '@/core/store/slices/memoryAgentSlice';

export const CATEGORY_ICONS: Record<AlwaysOnMemoryCategory, typeof Brain> = {
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

export const CATEGORY_COLORS: Record<AlwaysOnMemoryCategory, string> = {
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

export const TIER_LABELS: Record<MemoryTier, { label: string; color: string }> = {
    working: { label: 'Working', color: '#60a5fa' },
    shortTerm: { label: 'Short-Term', color: '#fbbf24' },
    longTerm: { label: 'Long-Term', color: '#34d399' },
    archived: { label: 'Archived', color: '#6b7280' },
};

export function formatTimeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(days / 365);
    return `${years}y ago`;
}

export const MemoryCard: React.FC<{
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

export const InsightCard: React.FC<{ insight: { id?: string; insight?: string; summary?: string } }> = ({ insight }) => (
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

export const StatCard: React.FC<{
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

export const DirectiveCard: React.FC<{ directive: Directive }> = ({ directive }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.01, boxShadow: '0 8px 30px rgba(59, 130, 246, 0.1)' }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            style={{
                padding: '14px 16px',
                borderRadius: 12,
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                marginBottom: 8,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Target size={14} color="#3b82f6" />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Directive
                </span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginLeft: 'auto' }}>
                    ID: {directive.id}
                </span>
            </div>

            <p style={{ fontSize: 14, color: 'white', margin: '0 0 8px 0', fontWeight: 500 }}>
                {directive.goalAncestry?.find(g => g.type === 'task')?.description || 'No specific task goal provided.'}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(59,130,246,0.1)', padding: '2px 8px', borderRadius: 4 }}>
                    <Server size={12} color="#3b82f6" />
                    <span style={{ fontSize: 10, color: '#3b82f6', fontWeight: 600 }}>{directive.status}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(168,85,247,0.1)', padding: '2px 8px', borderRadius: 4 }}>
                    <Sparkles size={12} color="#a855f7" />
                    <span style={{ fontSize: 10, color: '#a855f7', fontWeight: 600 }}>{directive.assignedAgent}</span>
                </div>
                {directive.computeAllocation && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(251,191,36,0.1)', padding: '2px 8px', borderRadius: 4 }}>
                        <Zap size={12} color="#fbbf24" />
                        <span style={{ fontSize: 10, color: '#fbbf24', fontWeight: 600 }}>
                            {directive.computeAllocation.tokensUsed} / {directive.computeAllocation.maxTokens}
                        </span>
                    </div>
                )}
                {directive.requiresDigitalHandshake && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: 4 }}>
                        <Shield size={12} color="#ef4444" />
                        <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>Governed</span>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

export const HandshakeApprovalCard: React.FC<{
    item: MemoryInboxItem;
    onApprove: () => void;
    onReject: () => void;
}> = ({ item, onApprove, onReject }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.01, boxShadow: '0 8px 30px rgba(239, 68, 68, 0.1)' }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            style={{
                padding: '14px 16px',
                borderRadius: 12,
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                marginBottom: 8,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Shield size={14} color="#ef4444" />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Digital Handshake Required
                </span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginLeft: 'auto' }}>
                    Directive: {item.directiveId}
                </span>
            </div>

            <p style={{ fontSize: 14, color: 'white', margin: '0 0 12px 0', fontWeight: 500 }}>
                {item.actionDescription}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                {item.computeExceeded && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(251,191,36,0.1)', padding: '2px 8px', borderRadius: 4 }}>
                        <Zap size={12} color="#fbbf24" />
                        <span style={{ fontSize: 10, color: '#fbbf24', fontWeight: 600 }}>Compute Exceeded</span>
                    </div>
                )}
                {item.isDestructive && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: 4 }}>
                        <AlertCircle size={12} color="#ef4444" />
                        <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>Destructive Action</span>
                    </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 4 }}>
                    <Clock size={12} color="#a1a1aa" />
                    <span style={{ fontSize: 10, color: '#a1a1aa', fontWeight: 600 }}>{item.status}</span>
                </div>
            </div>

            {item.status === 'PENDING' && (
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={onApprove}
                        style={{
                            flex: 1,
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.4)',
                            color: '#10b981',
                            padding: '8px 0',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)' }}
                    >
                        <CheckCircle size={14} /> Approve
                    </button>
                    <button
                        onClick={onReject}
                        style={{
                            flex: 1,
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            color: '#ef4444',
                            padding: '8px 0',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)' }}
                    >
                        <X size={14} /> Reject
                    </button>
                </div>
            )}
        </motion.div>
    );
};
