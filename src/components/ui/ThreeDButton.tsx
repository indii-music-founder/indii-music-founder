import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ThreeDButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    className?: string;
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
}

export const ThreeDButton = ({ children, className, variant = 'primary', ...props }: ThreeDButtonProps) => {

    const variants = {
        primary: "bg-white text-black border-b-4 border-gray-300 active:border-b-0 active:translate-y-1",
        secondary: "bg-gray-800 text-white border-b-4 border-gray-950 active:border-b-0 active:translate-y-1",
        danger: "bg-red-500 text-white border-b-4 border-red-700 active:border-b-0 active:translate-y-1",
        ghost: "bg-transparent text-white border-b-4 border-transparent active:border-b-0 active:translate-y-1 hover:bg-white/5",
    };

    return (
        <button
            className={cn(
                "relative px-6 py-3 rounded-xl font-bold transition-all duration-100 outline-none",
                variants[variant],
                className
            )}
            {...props}
        >
            {children}
        </button>
    );
};
