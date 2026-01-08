import React, { useState } from 'react';
import { Wine, Coffee, Apple, Droplet, Check, Plus, Trash2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRider } from '../hooks/useRider';
import { RiderItem } from '../types';

export const RiderChecklist: React.FC = () => {
    const { items, loading, addItem, toggleItem, deleteItem } = useRider();
    const [newItemLabel, setNewItemLabel] = useState('');
    const [newItemCategory, setNewItemCategory] = useState<RiderItem['category']>('essential');

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItemLabel.trim()) return;
        await addItem(newItemLabel, newItemCategory);
        setNewItemLabel('');
    };

    const getIcon = (category: string) => {
        switch (category) {
            case 'drink': return <Wine size={14} />;
            case 'food': return <Apple size={14} />;
            default: return <Droplet size={14} />;
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-[#161b22] border border-gray-800 rounded-xl p-6 h-full relative overflow-hidden flex flex-col"
        >
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none" />

            <div className="flex justify-between items-center mb-6 relative z-10">
                <h3 className="text-lg font-bold text-white flex items-center gap-3 uppercase tracking-tighter italic">
                    <Coffee className="text-purple-500" size={24} />
                    Hospitality Rider
                </h3>
            </div>

            {/* Add Item Form */}
            <form onSubmit={handleAddItem} className="mb-4 relative z-10">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newItemLabel}
                        onChange={(e) => setNewItemLabel(e.target.value)}
                        placeholder="Add new item..."
                        className="flex-1 bg-black/40 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-purple-500 outline-none placeholder:text-gray-600 transition-colors"
                    />
                    <select
                        value={newItemCategory}
                        onChange={(e) => setNewItemCategory(e.target.value as RiderItem['category'])}
                        className="bg-black/40 border border-gray-700/50 rounded-lg px-2 py-2 text-xs text-gray-400 focus:border-purple-500 outline-none cursor-pointer"
                        aria-label="Category"
                    >
                        <option value="essential">Essential</option>
                        <option value="food">Food</option>
                        <option value="drink">Drink</option>
                    </select>
                    <button
                        type="submit"
                        disabled={!newItemLabel.trim()}
                        className="p-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                        aria-label="Add Item"
                    >
                        <Plus size={16} />
                    </button>
                </div>
            </form>

            <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1 relative z-10">
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="animate-spin text-purple-500" size={24} />
                    </div>
                ) : items.length === 0 ? (
                    <div className="text-center py-8 text-gray-600 text-xs font-mono uppercase tracking-widest">
                        Rider list empty
                    </div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {items.map((item, idx) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={{ delay: idx * 0.05 }}
                                className={`group flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all duration-300 relative overflow-hidden ${item.completed
                                    ? 'bg-green-950/10 border-green-500/20 opacity-60'
                                    : 'bg-black/40 border-gray-800/50 hover:border-purple-500/40 hover:bg-gray-800/20'
                                    }`}
                            >
                                {/* Checkbox Visual */}
                                <div
                                    className="relative w-6 h-6 flex-shrink-0"
                                    onClick={() => toggleItem(item.id, !item.completed)}
                                >
                                    <motion.div
                                        initial={false}
                                        animate={{
                                            scale: item.completed ? 1 : 0.8,
                                            opacity: item.completed ? 1 : 0.5,
                                            rotate: item.completed ? 0 : -90
                                        }}
                                        className={`absolute inset-0 rounded flex items-center justify-center border ${item.completed ? 'bg-green-500 border-green-500' : 'bg-transparent border-gray-600 group-hover:border-purple-500'
                                            }`}
                                    >
                                        {item.completed && (
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                            >
                                                <Check className="text-white" size={16} />
                                            </motion.div>
                                        )}
                                    </motion.div>
                                </div>

                                <span
                                    className={`flex-1 text-sm font-medium tracking-tight ${item.completed ? 'text-gray-500 line-through' : 'text-gray-200'
                                        }`}
                                    onClick={() => toggleItem(item.id, !item.completed)}
                                >
                                    {item.label}
                                </span>

                                <div className="flex items-center gap-2">
                                    <div className={`p-2 rounded-lg transition-colors ${item.completed ? 'text-green-500/50 bg-green-500/5' : 'text-gray-600 bg-gray-800/30'
                                        }`}>
                                        {getIcon(item.category)}
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deleteItem(item.id);
                                        }}
                                        className="p-2 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                        aria-label="Delete Item"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-800/50 flex justify-between items-center text-[10px] font-mono uppercase tracking-[0.2em]">
                <span className="text-gray-500">
                    <span className="text-white">{items.filter(i => i.completed).length}</span> / {items.length} LOGGED
                </span>
                <span className={`font-black flex items-center gap-2 ${items.length > 0 && items.every(i => i.completed) ? 'text-green-500' : 'text-yellow-500/80'}`}>
                    <span className={`w-2 h-2 rounded-full animate-pulse ${items.length > 0 && items.every(i => i.completed) ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    {items.length > 0 && items.every(i => i.completed) ? 'All Set' : 'Show Ready'}
                </span>
            </div>
        </motion.div>
    );
};
