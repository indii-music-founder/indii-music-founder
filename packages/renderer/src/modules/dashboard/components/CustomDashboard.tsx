import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    LayoutDashboard,
    Plus,
    GripVertical,
    X,
    Edit3,
    Undo2,
} from 'lucide-react';


/* ================================================================== */
/*  Item 159 — Customizable Dashboard                                  */
/* ================================================================== */

import { WidgetType, Widget, WIDGET_DEFINITIONS, STORAGE_KEY, loadWidgets, WIDGET_RENDERERS } from "./CustomDashboardWidgets";

/* ── Custom Dashboard ──────────────────────────────────────────────── */

export function CustomDashboard() {
    const [widgets, setWidgets] = useState<Widget[]>(() => loadWidgets());
    const [isEditMode, setIsEditMode] = useState(false);
    const [showPicker, setShowPicker] = useState(false);
    const [dragId, setDragId] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    const widgetCounter = useRef(0);
    // Item 292: single-level undo for accidental drag-drops or removals
    const previousWidgets = useRef<Widget[] | null>(null);
    const [canUndo, setCanUndo] = useState(false);

    const saveSnapshot = useCallback(() => {
        previousWidgets.current = widgets;
        setCanUndo(true);
    }, [widgets]);

    const handleUndo = useCallback(() => {
        if (previousWidgets.current) {
            setWidgets(previousWidgets.current);
            previousWidgets.current = null;
            setCanUndo(false);
        }
    }, []);

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
        saveSnapshot();
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

        saveSnapshot();
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
    }, [dragId, saveSnapshot]);

    const addedTypes = new Set(widgets.map((w) => w.type));

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shadow-inner shadow-indigo-500/10">
                        <LayoutDashboard size={16} className="text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-white tracking-wide">My Dashboard</h2>
                        <p className="text-[10px] text-indigo-200/60 font-medium uppercase tracking-[0.1em] mt-0.5">{widgets.length} widget{widgets.length !== 1 ? 's' : ''} · drag to reorder</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {canUndo && (
                        <button
                            onClick={handleUndo}
                            aria-label="Undo last layout change"
                            title="Undo"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 text-[10px] font-bold transition-colors"
                        >
                            <Undo2 size={10} />
                            Undo
                        </button>
                    )}
                    <button
                        onClick={() => setIsEditMode((v) => !v)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${isEditMode
                            ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10'
                            }`}
                    >
                        <Edit3 size={10} />
                        {isEditMode ? 'Done' : 'Edit Layout'}
                    </button>
                    <button
                        onClick={() => setShowPicker((v) => !v)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold transition-colors"
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
                                        className={`flex items-start gap-2 p-3 rounded-lg text-left transition-colors ${alreadyAdded
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
                                className={`relative rounded-2xl p-4 border transition-all min-h-[180px] shadow-lg ${isOver
                                    ? 'border-indigo-500/40 bg-indigo-500/5 shadow-indigo-500/10'
                                    : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 shadow-black/20'
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
                                            className="w-5 h-5 rounded-full bg-slate-500/10 hover:bg-slate-500/30 border border-slate-500/20 text-slate-400 flex items-center justify-center transition-colors shadow-sm"
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
