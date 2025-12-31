import React, { useState } from 'react';
import { CheckSquare, Square, Wine, Coffee, Apple, Droplet } from 'lucide-react';

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
        <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6 h-full">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Coffee className="text-purple-500" size={20} />
                Hospitality Rider
            </h3>

            <div className="space-y-2">
                {items.map(item => (
                    <div
                        key={item.id}
                        onClick={() => toggleItem(item.id)}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${item.completed
                                ? 'bg-green-900/10 border-green-900/30 opacity-60'
                                : 'bg-black/20 border-gray-800 hover:border-gray-600'
                            }`}
                    >
                        {item.completed ? (
                            <CheckSquare className="text-green-500 flex-shrink-0" size={20} />
                        ) : (
                            <Square className="text-gray-500 flex-shrink-0" size={20} />
                        )}

                        <span className={`flex-1 text-sm ${item.completed ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
                            {item.label}
                        </span>

                        <span className="text-gray-600">
                            {getIcon(item.category)}
                        </span>
                    </div>
                ))}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-800 flex justify-between text-xs text-gray-500">
                <span>{items.filter(i => i.completed).length}/{items.length} Checked</span>
                <span className="uppercase tracking-wider">Show Ready</span>
            </div>
        </div>
    );
};
