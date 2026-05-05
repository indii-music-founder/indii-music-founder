import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    LayoutDashboard,
    Plus,
    GripVertical,
    X,
    Edit3,
    Undo2,
    Sparkles,
} from 'lucide-react';

/* ================================================================== */
/*  Item 159 — Customizable Dashboard                                  */
/* ================================================================== */

import { WidgetType, Widget, WIDGET_DEFINITIONS, STORAGE_KEY, loadWidgets, WIDGET_RENDERERS } from "./CustomDashboardWidgets";

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
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-2xl group-hover:bg-emerald-500/40 transition-all" />
                        <div className="relative w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center border border-white/20 shadow-2xl">
                            <LayoutDashboard size={24} className="text-black" />
                        </div>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight uppercase">My Dashboard</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <p className="text-[10px] text-emerald-400 font-black uppercase tracking-[0.2em]">{widgets.length} ACTIVE WIDGETS</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {canUndo && (
                        <button
                            onClick={handleUndo}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-gray-400 hover:text-white border border-white/10 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                            <Undo2 size={12} />
                            Undo
                        </button>
                    )}
                    <button
                        onClick={() => setIsEditMode((v) => !v)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-lg ${isEditMode
                            ? 'bg-emerald-500 text-black border-emerald-400'
                            : 'bg-white/5 text-gray-400 hover:text-white border-white/10 hover:bg-white/10'
                            }`}
                    >
                        <Edit3 size={12} />
                        {isEditMode ? 'Finish' : 'Edit'}
                    </button>
                    <button
                        onClick={() => setShowPicker((v) => !v)}
                        className="group relative flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-black text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] active:scale-95"
                    >
                        <Plus size={14} className="group-hover:rotate-90 transition-transform" />
                        Add Widget
                    </button>
                </div>
            </div>

            {/* Widget Picker */}
            <AnimatePresence>
                {showPicker && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="p-6 rounded-3xl glass border border-white/10 shadow-2xl relative overflow-hidden"
                    >
                        <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-emerald-500 to-transparent" />
                        <div className="flex items-center justify-between mb-6">
                            <p className="text-xs font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                                <Sparkles size={14} className="text-emerald-400" />
                                Available Intelligence
                            </p>
                            <button onClick={() => setShowPicker(false)} className="text-gray-500 hover:text-white transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                            {(Object.entries(WIDGET_DEFINITIONS) as [WidgetType, (typeof WIDGET_DEFINITIONS)[WidgetType]][]).map(([type, def]) => {
                                const Icon = def.icon;
                                const alreadyAdded = addedTypes.has(type);
                                return (
                                    <button
                                        key={type}
                                        onClick={() => addWidget(type)}
                                        disabled={alreadyAdded}
                                        className={`group relative flex flex-col gap-3 p-5 rounded-2xl text-left transition-all ${alreadyAdded
                                            ? 'bg-white/[0.02] opacity-40 cursor-not-allowed'
                                            : 'bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-emerald-500/40 cursor-pointer hover:scale-[1.02]'
                                            }`}
                                    >
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${alreadyAdded ? 'bg-white/5' : 'bg-emerald-500/10 group-hover:bg-emerald-500 group-hover:text-black'}`}>
                                            <Icon size={20} className={alreadyAdded ? 'text-gray-600' : 'text-emerald-400 group-hover:text-black'} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-white uppercase tracking-wider">{def.label}</p>
                                            <p className="text-[10px] text-gray-500 leading-tight mt-1 line-clamp-2">{alreadyAdded ? 'Integrated' : def.description}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Widget Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence mode="popLayout">
                    {sortedWidgets.map((widget) => {
                        const def = WIDGET_DEFINITIONS[widget.type];
                        const isDragging = dragId === widget.id;
                        const isOver = dragOverId === widget.id;

                        return (
                            <motion.div
                                key={widget.id}
                                layout
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: isDragging ? 0.3 : 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                                draggable={isEditMode}
                                onDragStart={() => handleDragStart(widget.id)}
                                onDragOver={(e) => handleDragOver(e, widget.id)}
                                onDrop={(e) => handleDrop(e, widget.id)}
                                onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                                className={`group relative rounded-3xl p-6 transition-all min-h-[220px] shadow-2xl overflow-hidden border ${isOver
                                    ? 'border-emerald-500/50 bg-emerald-500/10 scale-[1.02]'
                                    : 'border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10'
                                    } ${isEditMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
                            >
                                {/* Decorative Glow */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity" />
                                
                                {/* Edit mode controls */}
                                {isEditMode && (
                                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-20">
                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/60 border border-white/10 backdrop-blur-md">
                                            <GripVertical size={12} className="text-emerald-400" />
                                            <span className="text-[8px] font-black text-white uppercase tracking-widest">DRAG TO REORDER</span>
                                        </div>
                                        <button
                                            onClick={() => removeWidget(widget.id)}
                                            className="w-7 h-7 rounded-lg bg-red-500/20 hover:bg-red-500 border border-red-500/20 text-red-400 hover:text-black flex items-center justify-center transition-all shadow-lg"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                )}

                                <div className={`relative z-10 h-full ${isEditMode ? 'mt-8' : ''}`}>
                                    {WIDGET_RENDERERS[widget.type]()}
                                </div>

                                {/* Hover Border Accent */}
                                <div className="absolute inset-x-0 bottom-0 h-[2px] bg-emerald-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-500" />
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                {widgets.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="col-span-full flex flex-col items-center justify-center py-32 text-center"
                    >
                        <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                            <LayoutDashboard size={40} className="text-gray-700" />
                        </div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tight">Your OS is empty</h3>
                        <p className="text-sm text-gray-500 mt-2 max-w-xs">Initialize your dashboard by adding intelligence widgets to track your performance.</p>
                        <button
                            onClick={() => setShowPicker(true)}
                            className="mt-8 px-8 py-3 bg-emerald-500 text-black font-black uppercase tracking-widest rounded-xl shadow-2xl hover:scale-105 active:scale-95 transition-all"
                        >
                            Build My Dashboard
                        </button>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
