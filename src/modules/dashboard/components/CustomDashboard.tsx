import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    LayoutDashboard,
    Plus,
    GripVertical,
    X,
    Music,
    DollarSign,
    Calendar,
    TrendingUp,
    Bot,
    Edit3,
} from 'lucide-react';

/* ================================================================== */
/*  Item 159 — Customizable Dashboard                                  */
/* ================================================================== */

type WidgetType = 'streams_today' | 'revenue_mtd' | 'next_release' | 'top_track' | 'agent_activity';

interface Widget {
    id: string;
    type: WidgetType;
    order: number;
}

const WIDGET_DEFINITIONS: Record<WidgetType, { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; description: string }> = {
    streams_today: { label: 'Streams Today', icon: Music, description: 'Daily stream count across all DSPs' },
    revenue_mtd: { label: 'Revenue MTD', icon: DollarSign, description: 'Month-to-date royalty revenue' },
    next_release: { label: 'Next Release', icon: Calendar, description: 'Countdown to your next scheduled release' },
    top_track: { label: 'Top Track', icon: TrendingUp, description: 'Your best performing track right now' },
    agent_activity: { label: 'Agent Activity', icon: Bot, description: 'Recent AI agent tasks and completions' },
};

const DEFAULT_WIDGETS: Widget[] = [
    { id: 'w1', type: 'streams_today', order: 0 },
    { id: 'w2', type: 'revenue_mtd', order: 1 },
    { id: 'w3', type: 'next_release', order: 2 },
    { id: 'w4', type: 'top_track', order: 3 },
];

const STORAGE_KEY = 'indiiOS_custom_dashboard_widgets';

function loadWidgets(): Widget[] {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved) as Widget[];
    } catch {
        // ignore
    }
    return DEFAULT_WIDGETS;
}

/* ── Individual Widget Content ─────────────────────────────────────── */

function StreamsTodayWidget() {
    return (
        <div className="flex flex-col h-full justify-between">
            <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Music size={12} className="text-purple-400" />
                </div>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Streams Today</span>
            </div>
            <div>
                <p className="text-3xl font-black text-white">84.2K</p>
                <p className="text-[10px] text-green-400 font-bold mt-1">+12% vs yesterday</p>
            </div>
            <div className="mt-3 flex items-end gap-1 h-8">
                {[40, 55, 45, 70, 60, 80, 84].map((v, i) => (
                    <div key={i} className="flex-1 rounded-sm bg-purple-500/20 hover:bg-purple-500/40 transition-colors" style={{ height: `${(v / 84) * 100}%` }} />
                ))}
            </div>
        </div>
    );
}

function RevenueMTDWidget() {
    return (
        <div className="flex flex-col h-full justify-between">
            <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <DollarSign size={12} className="text-green-400" />
                </div>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Revenue MTD</span>
            </div>
            <div>
                <p className="text-3xl font-black text-white">$4,218</p>
                <p className="text-[10px] text-gray-500 mt-1">7 days into March 2026</p>
            </div>
            <div className="mt-3">
                <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="text-gray-500">Goal: $18,000</span>
                    <span className="text-green-400 font-bold">23%</span>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: '23%' }}
                        transition={{ duration: 0.8 }}
                    />
                </div>
            </div>
        </div>
    );
}

function NextReleaseWidget() {
    const daysUntil = 14;
    return (
        <div className="flex flex-col h-full justify-between">
            <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Calendar size={12} className="text-blue-400" />
                </div>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Next Release</span>
            </div>
            <div>
                <p className="text-3xl font-black text-white">{daysUntil}d</p>
                <p className="text-xs font-bold text-white mt-1">Glass Waves EP</p>
                <p className="text-[10px] text-gray-500">March 21, 2026</p>
            </div>
            <div className="mt-3 p-2 rounded-lg bg-blue-500/5 border border-blue-500/10">
                <p className="text-[10px] text-blue-400">Distribution submitted · Awaiting DSP approval</p>
            </div>
        </div>
    );
}

function TopTrackWidget() {
    return (
        <div className="flex flex-col h-full justify-between">
            <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <TrendingUp size={12} className="text-amber-400" />
                </div>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Top Track</span>
            </div>
            <div>
                <p className="text-sm font-black text-white">Midnight Circuit</p>
                <p className="text-[10px] text-gray-500 mb-2">Released Feb 1, 2026</p>
                <div className="space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500">Streams</span>
                        <span className="text-[10px] font-bold text-white">2.4M</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500">Revenue</span>
                        <span className="text-[10px] font-bold text-green-400">$9,600</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500">Save Rate</span>
                        <span className="text-[10px] font-bold text-amber-400">34%</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function AgentActivityWidget() {
    const activities = [
        { agent: 'DistributionAgent', action: 'DDEX uploaded to TuneCore', time: '2m ago', status: 'success' },
        { agent: 'FinanceAgent', action: 'Royalties calculated', time: '8m ago', status: 'success' },
        { agent: 'PublicistAgent', action: 'Press release sent', time: '15m ago', status: 'success' },
        { agent: 'MarketingAgent', action: 'Campaign scheduled', time: '1h ago', status: 'pending' },
    ];

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                    <Bot size={12} className="text-indigo-400" />
                </div>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Agent Activity</span>
            </div>
            <div className="space-y-1.5 flex-1 overflow-y-auto">
                {activities.map((a, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${a.status === 'success' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-gray-300 truncate">{a.action}</p>
                            <p className="text-[9px] text-gray-600">{a.agent}</p>
                        </div>
                        <span className="text-[9px] text-gray-600 flex-shrink-0">{a.time}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

const WIDGET_RENDERERS: Record<WidgetType, () => React.ReactElement> = {
    streams_today: () => <StreamsTodayWidget />,
    revenue_mtd: () => <RevenueMTDWidget />,
    next_release: () => <NextReleaseWidget />,
    top_track: () => <TopTrackWidget />,
    agent_activity: () => <AgentActivityWidget />,
};

/* ── Custom Dashboard ──────────────────────────────────────────────── */

export function CustomDashboard() {
    const [widgets, setWidgets] = useState<Widget[]>(() => loadWidgets());
    const [isEditMode, setIsEditMode] = useState(false);
    const [showPicker, setShowPicker] = useState(false);
    const [dragId, setDragId] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    const widgetCounter = useRef(0);

    // Persist to localStorage whenever widgets change
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
        } catch {
            // ignore storage errors
        }
    }, [widgets]);

    const sortedWidgets = [...widgets].sort((a, b) => a.order - b.order);

    function removeWidget(id: string) {
        setWidgets((prev) => prev.filter((w) => w.id !== id));
    }

    function addWidget(type: WidgetType) {
        const existing = widgets.find((w) => w.type === type);
        if (existing) return; // don't add duplicates
        widgetCounter.current += 1;
        const newWidget: Widget = {
            id: `w_${widgetCounter.current}`,
            type,
            order: widgets.length,
        };
        setWidgets((prev) => [...prev, newWidget]);
        setShowPicker(false);
    }

    const handleDragStart = useCallback((id: string) => {
        setDragId(id);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
        e.preventDefault();
        setDragOverId(id);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        if (!dragId || dragId === targetId) {
            setDragId(null);
            setDragOverId(null);
            return;
        }

        setWidgets((prev) => {
            const dragWidget = prev.find((w) => w.id === dragId);
            const targetWidget = prev.find((w) => w.id === targetId);
            if (!dragWidget || !targetWidget) return prev;

            const dragOrder = dragWidget.order;
            const targetOrder = targetWidget.order;

            return prev.map((w) => {
                if (w.id === dragId) return { ...w, order: targetOrder };
                if (w.id === targetId) return { ...w, order: dragOrder };
                return w;
            });
        });

        setDragId(null);
        setDragOverId(null);
    }, [dragId]);

    const addedTypes = new Set(widgets.map((w) => w.type));

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-dept-marketing/10 flex items-center justify-center">
                        <LayoutDashboard size={14} className="text-dept-marketing" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-white">Custom Dashboard</h2>
                        <p className="text-[10px] text-gray-500">{widgets.length} widget{widgets.length !== 1 ? 's' : ''} · drag to reorder</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsEditMode((v) => !v)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${
                            isEditMode
                                ? 'bg-dept-marketing/10 text-dept-marketing border border-dept-marketing/20'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                    >
                        <Edit3 size={10} />
                        {isEditMode ? 'Done' : 'Edit Layout'}
                    </button>
                    <button
                        onClick={() => setShowPicker((v) => !v)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dept-marketing/10 hover:bg-dept-marketing/20 text-dept-marketing text-[10px] font-bold transition-colors"
                    >
                        <Plus size={10} />
                        Add Widget
                    </button>
                </div>
            </div>

            {/* Widget Picker */}
            <AnimatePresence>
                {showPicker && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="p-4 rounded-xl bg-white/[0.03] border border-white/10"
                    >
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Available Widgets</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {(Object.entries(WIDGET_DEFINITIONS) as [WidgetType, (typeof WIDGET_DEFINITIONS)[WidgetType]][]).map(([type, def]) => {
                                const Icon = def.icon;
                                const alreadyAdded = addedTypes.has(type);
                                return (
                                    <button
                                        key={type}
                                        onClick={() => addWidget(type)}
                                        disabled={alreadyAdded}
                                        className={`flex items-start gap-2 p-3 rounded-lg text-left transition-colors ${
                                            alreadyAdded
                                                ? 'bg-white/[0.02] opacity-40 cursor-not-allowed'
                                                : 'bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 cursor-pointer'
                                        }`}
                                    >
                                        <Icon size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-white truncate">{def.label}</p>
                                            <p className="text-[10px] text-gray-500">{alreadyAdded ? 'Added' : def.description}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Widget Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                <AnimatePresence>
                    {sortedWidgets.map((widget) => {
                        const def = WIDGET_DEFINITIONS[widget.type];
                        const isDragging = dragId === widget.id;
                        const isOver = dragOverId === widget.id;

                        return (
                            <motion.div
                                key={widget.id}
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: isDragging ? 0.5 : 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                draggable={isEditMode}
                                onDragStart={() => handleDragStart(widget.id)}
                                onDragOver={(e) => handleDragOver(e, widget.id)}
                                onDrop={(e) => handleDrop(e, widget.id)}
                                onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                                className={`relative rounded-xl p-4 border transition-all min-h-[180px] ${
                                    isOver
                                        ? 'border-dept-marketing/40 bg-dept-marketing/5'
                                        : 'border-white/5 bg-white/[0.02]'
                                } ${isEditMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
                            >
                                {/* Edit mode controls */}
                                {isEditMode && (
                                    <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-10">
                                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/40">
                                            <GripVertical size={12} className="text-gray-500" />
                                            <span className="text-[9px] text-gray-500">drag</span>
                                        </div>
                                        <button
                                            onClick={() => removeWidget(widget.id)}
                                            className="w-5 h-5 rounded-full bg-red-500/10 hover:bg-red-500/30 text-red-400 flex items-center justify-center transition-colors"
                                        >
                                            <X size={10} />
                                        </button>
                                    </div>
                                )}

                                <div className={isEditMode ? 'mt-6' : ''}>
                                    {WIDGET_RENDERERS[widget.type]()}
                                </div>

                                {/* Widget type label in edit mode */}
                                {isEditMode && (
                                    <div className="absolute bottom-2 right-2">
                                        <span className="text-[9px] text-gray-600 font-mono">{def.label}</span>
                                    </div>
                                )}
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                {widgets.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="col-span-full flex flex-col items-center justify-center py-16 text-center"
                    >
                        <LayoutDashboard size={32} className="text-gray-700 mb-3" />
                        <p className="text-sm font-bold text-gray-500">No widgets yet</p>
                        <p className="text-xs text-gray-600 mt-1">Click "Add Widget" to build your dashboard</p>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
