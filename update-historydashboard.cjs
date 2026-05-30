const fs = require('fs');
const path = 'packages/renderer/src/modules/history/HistoryDashboard.tsx';
let content = fs.readFileSync(path, 'utf8');

// Add state for selected item
if (!content.includes("const [selectedItemId, setSelectedItemId] = useState<string | null>(null);")) {
    content = content.replace(
        "const [filterType, setFilterType] = useState<'all' | 'agent' | 'file'>('all');",
        "const [filterType, setFilterType] = useState<'all' | 'agent' | 'file'>('all');\n    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);"
    );
}

// Add click handler to timeline items
content = content.replace(
    /className="bg-surface\/30 border border-white\/5 rounded-xl p-4 hover:bg-surface\/50 transition-colors flex items-center justify-between group-hover:border-white\/10"/g,
    `className={cn("border rounded-xl p-4 transition-all flex items-center justify-between cursor-pointer", selectedItemId === item.id ? "bg-purple-900/20 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.15)]" : "bg-surface/30 border-white/5 hover:bg-surface/50 group-hover:border-white/10")} onClick={() => setSelectedItemId(item.id)}`
);

// Add import cn from @/lib/utils if not present
if (!content.includes("import { cn }")) {
    content = content.replace(
        "import { formatSmartDate } from '@/lib/utils';",
        "import { formatSmartDate, cn } from '@/lib/utils';"
    );
}
if (!content.includes("import { X, ArrowLeftRight } from 'lucide-react';")) {
    content = content.replace(
        "import { MessageSquare, Trash2, Clock, Search, Activity, FileText, Image as ImageIcon, Music, Video as VideoIcon, Bot } from 'lucide-react';",
        "import { MessageSquare, Trash2, Clock, Search, Activity, FileText, Image as ImageIcon, Music, Video as VideoIcon, Bot, X, ArrowLeftRight } from 'lucide-react';"
    );
}

// Add the Right Panel at the end before closing tags
const rightPanel = `
            {/* Right Context Panel (Diff/Revert Dashboard) */}
            <AnimatePresence>
                {selectedItemId && (
                    <motion.div
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 400, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        className="bg-surface/40 border-l border-white/5 backdrop-blur-xl z-20 flex flex-col"
                    >
                        <div className="p-4 border-b border-white/5 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                                <ArrowLeftRight size={16} className="text-purple-400" />
                                Version History & Diff
                            </h3>
                            <button onClick={() => setSelectedItemId(null)} className="p-1 hover:bg-white/10 rounded-md text-gray-400 transition-colors">
                                <X size={16} />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Diff View</h4>
                                <div className="bg-black/40 rounded-lg border border-white/5 font-mono text-xs overflow-hidden">
                                    <div className="bg-red-500/10 text-red-400 p-2 border-b border-white/5 line-through">
                                        - Previous state or deleted code
                                    </div>
                                    <div className="bg-green-500/10 text-green-400 p-2 border-b border-white/5">
                                        + Updated state or added feature
                                    </div>
                                    <div className="text-gray-500 p-2">
                                          unchanged line of code...
                                    </div>
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Actions</h4>
                                <button className="w-full flex items-center justify-center gap-2 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 px-4 py-3 rounded-xl font-bold transition-all">
                                    Revert to this point
                                </button>
                                <button className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 px-4 py-3 rounded-xl font-bold transition-all">
                                    Export Diff Log
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
`;

content = content.replace("        </div>\n    );\n}", rightPanel + "        </div>\n    );\n}");

fs.writeFileSync(path, content);
console.log("Updated HistoryDashboard.tsx");
