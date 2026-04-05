import React from 'react';
import { motion } from 'framer-motion';
import { User, Palette, Radio, CheckCircle } from 'lucide-react';

interface StepStepperProps {
    currentPhase: string;
}

const STEPS = [
    {
        id: 'identity',
        label: 'Identity',
        icon: User,
        phases: ['identity_intro', 'identity_core']
    },
    {
        id: 'branding',
        label: 'Branding',
        icon: Palette,
        phases: ['identity_branding', 'identity_visuals']
    },
    {
        id: 'release',
        label: 'Release',
        icon: Radio,
        phases: ['release_intro', 'release_details', 'release_assets']
    },
    {
        id: 'finish',
        label: 'Ready',
        icon: CheckCircle,
        phases: ['complete']
    }
];

export function StepStepper({ currentPhase }: StepStepperProps) {
    const currentIndex = STEPS.findIndex(s => s.phases.includes(currentPhase));
    const activeIndex = currentIndex === -1 ? 0 : currentIndex;

    return (
        <div className="flex items-center justify-between w-full max-w-2xl mx-auto mb-12 relative px-4">
            {/* Connection Line */}
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/5 -translate-y-1/2 z-0" />
            <motion.div
                className="absolute top-1/2 left-0 h-0.5 bg-gradient-to-r from-purple-500 to-cyan-500 -translate-y-1/2 z-0"
                initial={{ width: '0%' }}
                animate={{ width: `${(activeIndex / (STEPS.length - 1)) * 100}%` }}
                transition={{ duration: 0.8, ease: "easeInOut" }}
            />

            {STEPS.map((step, idx) => {
                const isCompleted = idx < activeIndex;
                const isActive = idx === activeIndex;
                const Icon = step.icon;

                return (
                    <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
                        <motion.div
                            initial={false}
                            animate={{
                                scale: isActive ? 1.1 : 1,
                                backgroundColor: isCompleted || isActive ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.05)',
                                color: isCompleted || isActive ? 'black' : 'rgba(255, 255, 255, 0.3)',
                                borderColor: isActive ? '#A855F7' : isCompleted ? '#22C55E' : 'rgba(255, 255, 255, 0.1)'
                            }}
                            className={`
                                w-10 h-10 lg:w-12 lg:h-12 rounded-2xl flex items-center justify-center border-2
                                shadow-2xl transition-all duration-500
                            `}
                        >
                            <Icon size={idx === STEPS.length - 1 && isCompleted ? 20 : 18} />
                        </motion.div>
                        <span className={`
                            text-[10px] font-black uppercase tracking-widest
                            ${isActive ? 'text-white' : isCompleted ? 'text-green-500' : 'text-gray-600'}
                        `}>
                            {step.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
