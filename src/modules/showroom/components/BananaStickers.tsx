import React from 'react';
import { motion } from 'framer-motion';
import { BananaTheme } from '../themes';

interface BananaStickersProps {
    theme: BananaTheme;
}

const STICKERS = [
    { id: 1, content: "🍌", x: "10%", y: "20%", rotate: 15, delay: 0 },
    { id: 2, content: "✨", x: "85%", y: "15%", rotate: -10, delay: 0.5 },
    { id: 3, content: "🔥", x: "15%", y: "85%", rotate: -20, delay: 1 },
    { id: 4, content: "💯", x: "90%", y: "80%", rotate: 25, delay: 1.5 },
    { id: 5, content: "👀", x: "50%", y: "90%", rotate: 5, delay: 2 },
];

export function BananaStickers({ theme }: BananaStickersProps) {
    if (theme.name !== 'standard') return null;

    return (
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
            {STICKERS.map((s) => (
                <motion.div
                    key={s.id}
                    className="absolute text-4xl opacity-20 filter blur-[1px]"
                    style={{ left: s.x, top: s.y }}
                    initial={{ scale: 0, rotate: 0 }}
                    animate={{
                        scale: [1, 1.2, 1],
                        rotate: [s.rotate, s.rotate + 10, s.rotate],
                        y: [0, -20, 0]
                    }}
                    transition={{
                        duration: 4,
                        repeat: Infinity,
                        delay: s.delay,
                        ease: "easeInOut"
                    }}
                >
                    {s.content}
                </motion.div>
            ))}
        </div>
    );
}
