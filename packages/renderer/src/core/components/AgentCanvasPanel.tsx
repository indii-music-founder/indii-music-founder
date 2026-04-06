import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/core/store';
import {
    X,
    BarChart3,
    Table2,
    LayoutGrid,
    FileText,
    Code2,
    ChevronLeft,
    ChevronRight,
    Trash2,
    PanelRightClose,
} from 'lucide-react';
import type { CanvasPushPayload, ChartPayload, TablePayload, CardPayload, MarkdownPayload } from '@/types/AgentCanvas';

/**
 * AgentCanvasPanel — Agent-to-UI Push (A2UI)
 *
 * Slide-out panel that renders agent-pushed visual content.
 * Supports chart, table, card, markdown, and HTML content types.
 */

const TYPE_ICONS: Record<string, typeof BarChart3> = {
    chart: BarChart3,
    table: Table2,
    card: LayoutGrid,
    markdown: FileText,
    html: Code2,
};

// ============================================================================
// Content Renderers
// ============================================================================

const ChartRenderer: React.FC<{ data: ChartPayload }> = ({ data }) => {
    // Recharts will be lazy-loaded when this component is used in production
    // For now, render a structured preview
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
                <BarChart3 size={12} />
                <span>{data.chartType} chart</span>
                <span className="text-zinc-600">•</span>
                <span>{data.data.length} data points</span>
            </div>
            <div className="bg-white/5 rounded-xl p-4 min-h-[200px] flex items-center justify-center border border-white/5">
                <div className="text-center">
                    <BarChart3 size={32} className="text-blue-400 mx-auto mb-2" />
                    <p className="text-sm text-zinc-400">
                        {data.chartType.charAt(0).toUpperCase() + data.chartType.slice(1)} Chart
                    </p>
                    <p className="text-xs text-zinc-600 mt-1">
                        X: {data.xKey} • Y: {data.yKeys.join(', ')}
                    </p>
                </div>
            </div>
            {/* Data preview table */}
            <div className="max-h-32 overflow-y-auto text-xs font-mono">
                <table className="w-full">
                    <thead>
                        <tr className="text-zinc-500 border-b border-white/5">
                            <th className="text-left py-1 px-2">{data.xKey}</th>
                            {data.yKeys.map((key) => (
                                <th key={key} className="text-right py-1 px-2">{key}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.data.slice(0, 5).map((row, i) => (
                            <tr key={i} className="text-zinc-400 border-b border-white/[0.02]">
                                <td className="py-1 px-2">{String(row[data.xKey])}</td>
                                {data.yKeys.map((key) => (
                                    <td key={key} className="text-right py-1 px-2">{String(row[key])}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const TableRenderer: React.FC<{ data: TablePayload }> = ({ data }) => (
    <div className="overflow-x-auto">
        <table className="w-full text-sm">
            <thead>
                <tr className="border-b border-white/10">
                    {data.columns.map((col) => (
                        <th
                            key={col.key}
                            className={`py-2 px-3 text-zinc-400 font-medium ${col.align === 'right' ? 'text-right' :
                                col.align === 'center' ? 'text-center' :
                                    'text-left'
                                }`}
                        >
                            {col.label}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {data.rows.map((row, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                        {data.columns.map((col) => (
                            <td
                                key={col.key}
                                className={`py-2 px-3 text-zinc-300 ${col.align === 'right' ? 'text-right' :
                                    col.align === 'center' ? 'text-center' :
                                        'text-left'
                                    }`}
                            >
                                {String(row[col.key] ?? '')}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const CardRenderer: React.FC<{ data: CardPayload }> = ({ data }) => (
    <div className="grid grid-cols-2 gap-3">
        {data.cards.map((card, i) => (
            <div
                key={i}
                className="bg-white/5 rounded-xl p-4 border border-white/5"
            >
                <p className="text-xs text-zinc-500 mb-1">{card.title}</p>
                <p className="text-2xl font-bold text-white tracking-tight">
                    {card.value}
                </p>
                {card.subtitle && (
                    <p className="text-xs text-zinc-500 mt-1">{card.subtitle}</p>
                )}
                {card.trend && (
                    <div className={`flex items-center gap-1 mt-2 text-xs ${card.trend === 'up' ? 'text-emerald-400' :
                        card.trend === 'down' ? 'text-red-400' :
                            'text-zinc-500'
                        }`}>
                        {card.trend === 'up' ? '↑' : card.trend === 'down' ? '↓' : '→'}
                        <span>{card.trendValue}</span>
                    </div>
                )}
            </div>
        ))}
    </div>
);

const MarkdownRenderer: React.FC<{ data: MarkdownPayload }> = ({ data }) => {
    /** Render inline formatting: **bold**, *italic*, `code` */
    const renderInline = (text: string): React.ReactNode[] => {
        const parts: React.ReactNode[] = [];
        // Match **bold**, *italic*, `code` in order
        const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        let key = 0;
        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                parts.push(text.slice(lastIndex, match.index));
            }
            if (match[2]) {
                parts.push(<strong key={key++} className="font-semibold text-white">{match[2]}</strong>);
            } else if (match[3]) {
                parts.push(<em key={key++} className="italic text-zinc-200">{match[3]}</em>);
            } else if (match[4]) {
                parts.push(<code key={key++} className="px-1 py-0.5 bg-white/10 rounded text-[13px] font-mono text-zinc-300">{match[4]}</code>);
            }
            lastIndex = match.index + match[0].length;
        }
        if (lastIndex < text.length) parts.push(text.slice(lastIndex));
        return parts;
    };

    return (
        <div className="prose prose-invert prose-sm max-w-none space-y-3">
            {data.content.split('\n\n').map((block, i) => {
                // Code blocks: ```lang\n...\n```
                if (block.startsWith('```')) {
                    const lines = block.split('\n');
                    const lang = lines[0]?.replace('```', '').trim() ?? '';
                    const lastLine = lines[lines.length - 1];
                    const code = lines.slice(1, lastLine === '```' ? -1 : undefined).join('\n');
                    return (
                        <div key={i} className="relative">
                            {lang && <span className="absolute top-2 right-3 text-[9px] text-zinc-600 font-mono uppercase">{lang}</span>}
                            <pre className="bg-white/5 rounded-lg p-3 text-xs font-mono text-zinc-300 overflow-x-auto border border-white/5">
                                <code>{code}</code>
                            </pre>
                        </div>
                    );
                }
                // Headers
                if (block.startsWith('### ')) return <h3 key={i} className="text-base font-medium text-white">{renderInline(block.slice(4))}</h3>;
                if (block.startsWith('## ')) return <h2 key={i} className="text-lg font-semibold text-white">{renderInline(block.slice(3))}</h2>;
                if (block.startsWith('# ')) return <h1 key={i} className="text-xl font-bold text-white">{renderInline(block.slice(2))}</h1>;
                // Unordered lists
                if (block.startsWith('- ')) return (
                    <ul key={i} className="list-disc list-inside text-zinc-300 space-y-0.5">
                        {block.split('\n').map((line, j) => (
                            <li key={j}>{renderInline(line.replace(/^- /, ''))}</li>
                        ))}
                    </ul>
                );
                // Ordered lists
                if (/^\d+\.\s/.test(block)) return (
                    <ol key={i} className="list-decimal list-inside text-zinc-300 space-y-0.5">
                        {block.split('\n').map((line, j) => (
                            <li key={j}>{renderInline(line.replace(/^\d+\.\s/, ''))}</li>
                        ))}
                    </ol>
                );
                // Paragraph
                return <p key={i} className="text-zinc-300 leading-relaxed">{renderInline(block)}</p>;
            })}
        </div>
    );
};

// ============================================================================
// Panel Component
// ============================================================================

const PanelContent: React.FC<{ panel: CanvasPushPayload }> = ({ panel }) => {
    switch (panel.type) {
        case 'chart':
            return <ChartRenderer data={panel.data as ChartPayload} />;
        case 'table':
            return <TableRenderer data={panel.data as TablePayload} />;
        case 'card':
            return <CardRenderer data={panel.data as CardPayload} />;
        case 'markdown':
            return <MarkdownRenderer data={panel.data as MarkdownPayload} />;
        case 'html':
            return (
                <div className="bg-white/5 rounded-xl p-4 text-center text-zinc-500 text-sm">
                    HTML rendering coming soon
                </div>
            );
        default:
            return (
                <pre className="text-xs text-zinc-400 overflow-auto">
                    {JSON.stringify(panel.data, null, 2)}
                </pre>
            );
    }
};

export const AgentCanvasPanel: React.FC = () => {
    const [activeIndex, setActiveIndex] = React.useState(0);

    const { isCanvasOpen, canvasPanels, toggleCanvas, removePanel, clearCanvas } = useStore(
        useShallow((state) => ({
            isCanvasOpen: state.isCanvasOpen,
            canvasPanels: state.canvasPanels,
            toggleCanvas: state.toggleCanvas,
            removePanel: state.removePanel,
            clearCanvas: state.clearCanvas,
        }))
    );

    // Clamp activeIndex when panels change: always show the latest pushed panel,
    // and clamp to valid range if panels were removed.
    React.useEffect(() => {
        if (canvasPanels.length === 0) return;
        setActiveIndex(canvasPanels.length - 1);
    }, [canvasPanels.length]);

    if (!isCanvasOpen || canvasPanels.length === 0) return null;

    const activePanel = canvasPanels[activeIndex];
    if (!activePanel) return null;

    const TypeIcon = TYPE_ICONS[activePanel.type] || FileText;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ x: '100%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 250 }}
                className="fixed top-0 right-0 bottom-0 w-[420px] z-40 bg-zinc-950/98 border-l border-white/10 shadow-2xl flex flex-col"
            >
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
                    <TypeIcon size={16} className="text-blue-400 flex-shrink-0" />
                    <h2 className="text-sm font-semibold text-white flex-1 truncate">
                        {activePanel.title}
                    </h2>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-zinc-500 font-mono">
                        {activePanel.agentId}
                    </span>
                    <button
                        onClick={() => removePanel(activePanel.id)}
                        className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
                        aria-label="Remove this panel"
                    >
                        <Trash2 size={14} className="text-zinc-600" />
                    </button>
                    <button
                        onClick={toggleCanvas}
                        className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
                        aria-label="Close canvas"
                    >
                        <PanelRightClose size={14} className="text-zinc-500" />
                    </button>
                </div>

                {/* Tab bar (when multiple panels) */}
                {canvasPanels.length > 1 && (
                    <div className="flex items-center gap-1 px-5 py-2 border-b border-white/5 overflow-x-auto">
                        <button
                            onClick={() => setActiveIndex(Math.max(0, activeIndex - 1))}
                            disabled={activeIndex === 0}
                            className="p-1 hover:bg-white/5 rounded disabled:opacity-20"
                        >
                            <ChevronLeft size={12} className="text-zinc-500" />
                        </button>
                        {canvasPanels.map((panel, idx) => {
                            const PIcon = TYPE_ICONS[panel.type] || FileText;
                            return (
                                <button
                                    key={panel.id}
                                    onClick={() => setActiveIndex(idx)}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] flex items-center gap-1.5 transition-colors ${idx === activeIndex
                                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                        : 'text-zinc-500 hover:bg-white/5'
                                        }`}
                                >
                                    <PIcon size={10} />
                                    <span className="truncate max-w-[80px]">{panel.title}</span>
                                </button>
                            );
                        })}
                        <button
                            onClick={() => setActiveIndex(Math.min(canvasPanels.length - 1, activeIndex + 1))}
                            disabled={activeIndex === canvasPanels.length - 1}
                            className="p-1 hover:bg-white/5 rounded disabled:opacity-20"
                        >
                            <ChevronRight size={12} className="text-zinc-500" />
                        </button>
                        <div className="flex-1" />
                        <button
                            onClick={clearCanvas}
                            className="text-[10px] text-zinc-600 hover:text-red-400 transition-colors"
                        >
                            Clear all
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activePanel.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2 }}
                        >
                            <PanelContent panel={activePanel} />
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="px-5 py-2 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[10px] text-zinc-600">
                        {canvasPanels.length} panel{canvasPanels.length !== 1 ? 's' : ''} • Agent Canvas
                    </span>
                    <button
                        onClick={toggleCanvas}
                        className="text-[10px] text-zinc-500 hover:text-white transition-colors flex items-center gap-1"
                    >
                        <X size={10} />
                        Close
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};
