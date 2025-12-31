import React from 'react';
import { motion } from 'framer-motion';

// In a real app, these would be proper image imports
const BANANA_ASSETS = [
    { id: 'banana-1', url: '🍌', name: 'Classic' },
    { id: 'banana-2', url: '✨🍌', name: 'Sparkle' },
    { id: 'banana-3', url: '🕶️', name: 'Cool' },
    { id: 'banana-4', url: '👑', name: 'King' },
    { id: 'banana-5', url: '🚀', name: 'Space' },
    { id: 'banana-6', url: '💎', name: 'Diamond' },
];

interface BananaAssetsProps {
    onSelect: (asset: typeof BANANA_ASSETS[0]) => void;
}

export const BananaAssets: React.FC<BananaAssetsProps> = ({ onSelect }) => {
    return (
        <div className="p-4 grid grid-cols-3 gap-3">
            {BANANA_ASSETS.map((asset) => (
                <motion.button
                    key={asset.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onSelect(asset)}
                    className="aspect-square flex flex-col items-center justify-center bg-neutral-800/50 hover:bg-[#FACC15]/10 border border-neutral-800 hover:border-[#FACC15]/50 rounded-xl transition-colors group"
                >
                    <span className="text-3xl mb-1 filter drop-shadow-lg group-hover:drop-shadow-[0_0_10px_rgba(250,204,21,0.5)] transition-all">
                        {asset.url}
                    </span>
                    <span className="text-[10px] text-neutral-500 group-hover:text-[#FACC15]">{asset.name}</span>
                </motion.button>
            ))}
        </div>
    );
};
