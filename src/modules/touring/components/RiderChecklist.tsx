import React, { useState } from 'react';
import { CheckSquare, Square, Wine, Coffee, Apple, Droplet, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface RiderItem {
    id: string;
    label: string;
    completed: boolean;
    category: 'food' | 'drink' | 'essential';
}

export const RiderChecklist: React.FC = () => {
    const [items, setItems] = useState<RiderItem[]>([
        { id: '1', label: '24 Bottles of Water (Room Temp)', completed: false, category: 'drink' },
        { id: '2', label: '12 Clean Black Towels', completed: false, category: 'essential' },
        { id: '3', label: 'Fresh Fruit Platter', completed: false, category: 'food' },
        { id: '4', label: 'Hummus & Pita', completed: true, category: 'food' },
        { id: '5', label: 'Hot Tea Station (Honey/Lemon)', completed: false, category: 'drink' },
        { id: '6', label: 'Local Beer (Case)', completed: false, category: 'drink' },
    ]);

    const toggleItem = (id: string) => {
        setItems(items.map(item =>
            item.id === id ? { ...item, completed: !item.completed } : item
        ));
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
            className="bg-[#161b22] border border-gray-800 rounded-xl p-6 h-full relative overflow-hidden"
        >
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none" />

            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-3 uppercase tracking-tighter italic">
                <Coffee className="text-purple-500" size={24} />
                Hospitality Rider
            </h3>

            <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                    {items.map((item, idx) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            onClick={() => toggleItem(item.id)}
                            className={`group flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all duration-300 relative overflow-hidden ${item.completed
                                    ? 'bg-green-950/10 border-green-500/20 opacity-60'
                                    : 'bg-black/40 border-gray-800/50 hover:border-purple-500/40 hover:bg-gray-800/20'
                                }`}
                        >
                            {/* Checkbox Visual */}
                            <div className="relative w-6 h-6 flex-shrink-0">
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

                            <span className={`flex-1 text-sm font-medium tracking-tight ${item.completed ? 'text-gray-500 line-through' : 'text-gray-200'
                                }`}>
                                {item.label}
                            </span>

                            <div className={`p-2 rounded-lg transition-colors ${item.completed ? 'text-green-500/50 bg-green-500/5' : 'text-gray-600 bg-gray-800/30'
                                }`}>
                                {getIcon(item.category)}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-800/50 flex justify-between items-center text-[10px] font-mono uppercase tracking-[0.2em]">
                <span className="text-gray-500">
                    <span className="text-white">{items.filter(i => i.completed).length}</span> / {items.length} LOGGED
                </span>
                <span className="text-yellow-500/80 font-black flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                    Show Ready
                </span>
            </div>
        </motion.div>
    );
};
