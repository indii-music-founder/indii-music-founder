import React, { useState } from 'react';
import { Wine, Coffee, Apple, Droplet, Check, Plus, Trash2, Loader2, ListTodo } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
        >
            <Card className="bg-[#161b22] border-gray-800 h-full relative overflow-hidden flex flex-col shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 blur-3xl rounded-full -mr-20 -mt-20 pointer-events-none" />

                {/* Header */}
                <div className="z-10 border-b border-gray-800">
                    <CardHeader className="flex flex-row items-end justify-between pb-4">
                        <div>
                            <CardTitle className="text-xl font-black text-white flex items-center gap-3 uppercase tracking-tighter italic">
                                <ListTodo className="text-purple-500" size={28} />
                                Hospitality Rider
                            </CardTitle>
                            <p className="text-xs text-gray-500 font-mono uppercase tracking-widest mt-1 ml-10">Backstage Inventory</p>
                        </div>

                        <div className={`font-mono text-xs font-bold px-3 py-1 rounded-full border ${items.length > 0 && items.every(i => i.completed)
                            ? 'bg-green-500/10 border-green-500/30 text-green-400'
                            : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500'
                            }`}>
                            {items.filter(i => i.completed).length} / {items.length} FULFILLED
                        </div>
                    </CardHeader>
                </div>

                <CardContent className="flex-1 flex flex-col gap-6 p-6 z-10 w-full overflow-hidden">
                    {/* Add Item Form */}
                    <form onSubmit={handleAddItem} className="">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newItemLabel}
                                onChange={(e) => setNewItemLabel(e.target.value)}
                                placeholder="Add requirement..."
                                aria-label="New item name"
                                className="flex-1 bg-[#0d1117] border border-gray-700 rounded-lg px-4 py-3 text-sm text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 outline-none placeholder:text-gray-600 transition-all font-mono"
                            />
                            <select
                                value={newItemCategory}
                                onChange={(e) => setNewItemCategory(e.target.value as RiderItem['category'])}
                                className="bg-[#0d1117] border border-gray-700 rounded-lg px-3 py-3 text-xs text-gray-400 focus:border-purple-500 outline-none cursor-pointer uppercase font-bold tracking-wider"
                                aria-label="Category"
                            >
                                <option value="essential">Essential</option>
                                <option value="food">Food</option>
                                <option value="drink">Drink</option>
                            </select>
                            <Button
                                type="submit"
                                disabled={!newItemLabel.trim()}
                                className="p-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg shadow-[0_0_15px_rgba(147,51,234,0.3)] h-auto"
                                aria-label="Add Item"
                            >
                                <Plus size={18} />
                            </Button>
                        </div>
                    </form>

                    <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar pr-1">
                        {loading ? (
                            <div className="flex items-center justify-center py-12 flex-col gap-3">
                                <Loader2 className="animate-spin text-purple-500" size={32} />
                                <span className="text-xs text-gray-600 uppercase tracking-widest animate-pulse">Syncing Inventory...</span>
                            </div>
                        ) : items.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-4 opacity-50">
                                <Coffee size={48} strokeWidth={1} />
                                <div className="text-xs font-mono uppercase tracking-widest">No items requested</div>
                            </div>
                        ) : (
                            <AnimatePresence mode="popLayout">
                                {items.map((item, idx) => (
                                    <motion.div
                                        key={item.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        transition={{ delay: idx * 0.03 }}
                                        onClick={() => toggleItem(item.id, !item.completed)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                toggleItem(item.id, !item.completed);
                                            }
                                        }}
                                        className={`group flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-all duration-200 relative overflow-hidden focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#161b22] outline-none ${item.completed
                                            ? 'bg-green-950/10 border-green-900/30 opacity-60'
                                            : 'bg-[#0d1117] border-gray-800 hover:border-purple-500/50 hover:shadow-[0_4px_12px_rgba(0,0,0,0.2)]'
                                            }`}
                                    >
                                        {/* Checkbox Visual */}
                                        <div className="relative w-5 h-5 flex-shrink-0">
                                            <div className={`absolute inset-0 rounded flex items-center justify-center border transition-all ${item.completed
                                                ? 'bg-green-500 border-green-500'
                                                : 'bg-transparent border-gray-600 group-hover:border-purple-400 group-focus-visible:border-purple-400'
                                                }`}>
                                                {item.completed && <Check className="text-black" size={12} strokeWidth={3} />}
                                            </div>
                                        </div>

                                        <span className={`flex-1 text-sm font-mono tracking-tight transition-colors ${item.completed ? 'text-gray-500 line-through decoration-gray-700' : 'text-gray-200 group-hover:text-white'
                                            }`}>
                                            {item.label}
                                        </span>

                                        <div className="flex items-center gap-2">
                                            <div className={`p-1.5 rounded-md text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 ${item.completed ? 'text-green-500/50 bg-green-500/5' : 'text-gray-500 bg-gray-800'
                                                }`}>
                                                {getIcon(item.category)}
                                                <span className="hidden sm:inline">{item.category}</span>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteItem(item.id);
                                                }}
                                                className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-red-500 outline-none"
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
                </CardContent>
            </Card>
        </motion.div>
    );
};
