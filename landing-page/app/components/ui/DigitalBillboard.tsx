'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PulseText from './PulseText';
import PulseButton from './PulseButton';
import Link from 'next/link';

interface SlideData {
    id: string;
    content: React.ReactNode;
    subheadline: string;
    cta: {
        label: string;
        href: string;
    };
}

import { BILLBOARD_SLIDES } from '../../lib/billboardContent';

export default function DigitalBillboard() {
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

    return (
        <div className="relative h-[400px] flex flex-col items-center justify-center">
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentSlide.id}
                    initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -20, filter: "blur(10px)" }}
                    transition={{ duration: 0.8, ease: "easeInOut" }}
                    className="text-center"
                >
                    {/* Headline */}
                    <div className="text-5xl md:text-7xl font-bold mb-6 tracking-tighter">
                        {currentSlide.content}
                    </div>

                    {/* Subheadline */}
                    <PulseText className="mb-8 max-w-lg mx-auto">
                        <p className="text-xl md:text-2xl text-gray-300 font-light tracking-wide">
                            {currentSlide.subheadline}
                        </p>
                    </PulseText>

                    {/* CTA Button */}
                    <Link href={currentSlide.cta.href}>
                        <PulseButton className="px-8 py-4 text-lg bg-white text-black rounded-full font-bold hover:bg-gray-200 transition-all transform hover:scale-105">
                            {currentSlide.cta.label}
                        </PulseButton>
                    </Link>
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
