'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

const CHARS = "-_~=\\/[]{}<>;*+!@#%^&";

interface ScrambleTextProps {
    text: string;
    className?: string;
    scrambleSpeed?: number;
    revealSpeed?: number;
    delay?: number;
}

export default function ScrambleText({
    text,
    className = "",
    scrambleSpeed = 50,
    revealSpeed = 50,
    delay = 0
}: ScrambleTextProps) {
    const [displayText, setDisplayText] = useState('');
    // const controls = useAnimation(); // Unused

    useEffect(() => {
        let isCancelled = false;
        // let timeout: NodeJS.Timeout; // Unused

        const animate = async () => {
            setDisplayText(''); // Clear initially

            // Initial Delay
            await new Promise(r => setTimeout(r, delay));
            if (isCancelled) return;

            const length = text.length;
            let revealed = 0;
            const output = Array(length).fill('').map(() => CHARS[Math.floor(Math.random() * CHARS.length)]);

            // Initial scramble phase (fill with chaos)
            for (let i = 0; i < 10; i++) {
                if (isCancelled) return;
                const randomChars = output.map((c, idx) =>
                    idx < revealed ? text[idx] : CHARS[Math.floor(Math.random() * CHARS.length)]
                );
                setDisplayText(randomChars.join(''));
                await new Promise(r => setTimeout(r, scrambleSpeed));
            }

            // Reveal phase
            const timer = setInterval(() => {
                if (isCancelled) {
                    clearInterval(timer);
                    return;
                }

                revealed++;

                const currentText = text.split('').map((char, index) => {
                    if (index < revealed) return char;
                    return CHARS[Math.floor(Math.random() * CHARS.length)];
                }).join('');

                setDisplayText(currentText);

                if (revealed >= length) {
                    clearInterval(timer);
                }
            }, revealSpeed);
        };

        animate();

        return () => {
            isCancelled = true;
        };
    }, [text, delay, scrambleSpeed, revealSpeed]);

    return (
        <motion.span
            className={`font-mono inline-block ${className}`}
            initial={{ opacity: 0.8 }}
            animate={{ opacity: 1 }}
        >
            {displayText}
        </motion.span>
    );
}
