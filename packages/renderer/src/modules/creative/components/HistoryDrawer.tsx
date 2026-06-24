import { useState } from 'react';
import { X, Layers, Clock } from 'lucide-react';
import DesignHistoryDrawer from './DesignHistoryDrawer';
import PromptHistoryDrawer from './PromptHistoryDrawer';

/**
 * Unified History drawer (ISSUE-496) — folds the previously-separate "Versions"
 * (Design Versions) and "Prompt History" surfaces into one panel with tabs, so
 * history isn't fragmented across multiple floating drawers. Part of IA Option C.
 */
type HistoryTab = 'versions' | 'prompts';

export default function HistoryDrawer({ onClose }: { onClose: () => void }) {
    const [tab, setTab] = useState<HistoryTab>('versions');

    return (
        <div className="absolute top-full right-0 mt-2 mr-2 w-80 bg-[#0f0f0f]/95 backdrop-blur-xl border border-white/10 rounded-xl z-50 flex flex-col max-h-[80vh] overflow-hidden shadow-2xl animate-in slide-in-from-top-2 fade-in duration-200">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                <h3 className="text-sm font-bold text-white">History</h3>
                <button onClick={onClose} aria-label="Close history" className="p-1 hover:bg-white/10 rounded-full text-gray-500 hover:text-white transition-colors">
                    <X size={18} />
                </button>
            </div>

            {/* Tab switcher */}
            <div className="flex p-2 gap-1 border-b border-white/5">
                <button
                    onClick={() => setTab('versions')}
                    data-testid="history-tab-versions"
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${tab === 'versions'
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                >
                    <Layers size={12} /> Versions
                </button>
                <button
                    onClick={() => setTab('prompts')}
                    data-testid="history-tab-prompts"
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${tab === 'prompts'
                        ? 'bg-purple-500/15 text-purple-300'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                >
                    <Clock size={12} /> Prompts
                </button>
            </div>

            {/* Active tab body (embedded = no own chrome) */}
            {tab === 'versions'
                ? <DesignHistoryDrawer onClose={onClose} embedded />
                : <PromptHistoryDrawer onClose={onClose} embedded />}
        </div>
    );
}
