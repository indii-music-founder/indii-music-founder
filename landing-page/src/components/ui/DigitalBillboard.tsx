'use client';


import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PulseText from './PulseText';
import PulseButton from './PulseButton';
// import Link from 'next/link';

// interface SlideData {
//     id: string;
//     content: React.ReactNode;
//     subheadline: string;
//     cta: {
//         label: string;
//         href: string;
//     };
// }

import { BILLBOARD_SLIDES } from '../../lib/billboardContent';

interface DigitalBillboardProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    user?: any;
    authenticatedCta?: {
        label: string;
        href: string;
    };
}

export default function DigitalBillboard({ user, authenticatedCta }: DigitalBillboardProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const slides = BILLBOARD_SLIDES;

    // Slide Duration: 8 seconds (gives enough time to read and enjoy visuals)
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % slides.length);
        }, 8000);

        return () => clearInterval(timer);
    }, []);

    const currentSlide = slides[currentIndex];
    const effectiveCta = (user && authenticatedCta) ? authenticatedCta : currentSlide.cta;

    // 3. Micro-delight: Interactive Tilt on Hover
    const [tilt, setTilt] = useState({ x: 0, y: 0 });
    const handleMouseMove = (e: React.MouseEvent) => {
        const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - left - width / 2) / 20; // Sensitivity 
        const y = (e.clientY - top - height / 2) / 20;
        setTilt({ x, y });
    };

    return (
        <div
            className="relative h-[400px] flex flex-col items-center justify-center perspective-1000"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setTilt({ x: 0, y: 0 })}
        >
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentSlide.id}
                    initial={{ opacity: 0, y: 20, filter: "blur(10px)", rotateX: 0, rotateY: 0 }}
                    animate={{
                        opacity: 1,
                        y: 0,
                        filter: "blur(0px)",
                        rotateX: -tilt.y, // Inverse for natural feel
                        rotateY: tilt.x
                    }}
                    exit={{ opacity: 0, y: -20, filter: "blur(10px)" }}
                    transition={{ duration: 0.8, ease: "easeInOut", type: "spring", stiffness: 200, damping: 20 }}
                    className="text-center transform-style-3d cursor-none" // Invites interaction
                >
                    {/* Headline - Split text animation could go here for extra credit */}
                    <div className="text-5xl md:text-7xl font-bold mb-6 tracking-tighter hover:glow-text-blue transition-all">
                        {currentSlide.content}
                    </div>

                    {/* Subheadline */}
                    <PulseText className="mb-8 max-w-lg mx-auto">
                        <p className="text-xl md:text-2xl text-gray-300 font-light tracking-wide">
                            {currentSlide.subheadline}
                        </p>
                    </PulseText>

                    {/* CTA Button with Magnetic Pull (implied by layout) */}
                    <a href={effectiveCta.href}>
                        <PulseButton className="px-8 py-4 text-lg bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-full font-bold hover:bg-white hover:text-black transition-all transform hover:scale-110 shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                            {effectiveCta.label}
                        </PulseButton>
                    </a>
                </motion.div>
            </AnimatePresence>

            {/* Pagination Indicators */}
            <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 flex gap-3">
                {slides.map((slide, index) => (
                    <button
                        key={slide.id}
                        onClick={() => setCurrentIndex(index)}
                        className={`w-2 h-2 rounded-full transition-all duration-500 ${index === currentIndex ? 'bg-white w-8' : 'bg-gray-600 hover:bg-gray-400'
                            }`}
                        aria-label={`Go to slide ${index + 1}`}
                    />
                ))}
            </div>
        </div>
    );
}
