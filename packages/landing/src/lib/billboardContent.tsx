import React from 'react';
import ScrambleText from '../components/ui/ScrambleText';

export const BILLBOARD_SLIDES = [
    {
        id: 'hero',
        content: (
            <div className="leading-tight">
                <ScrambleText text="Your Music." className="filter drop-shadow-2xl mb-1" />
                <br />
                <ScrambleText text="Your Rules." delay={800} className="text-glow-blue filter drop-shadow-2xl" />
            </div>
        ),
        subheadline: "The Operating System for Independence.",
        cta: { label: "Start Creating", href: "/signup" }
    },
    {
        id: 'studio',
        content: (
            <div className="leading-tight">
                <ScrambleText text="Managed Metadata." className="opacity-90" />
                <br />
                <ScrambleText text="Protected Masters." delay={800} className="font-extrabold text-glow-blue opacity-100" />
            </div>
        ),
        subheadline: "Your masters never leave your hard drive. We just help you manage them.",
        cta: { label: "Enter Studio", href: "/login" }
    },
    {
        id: 'network',
        content: (
            <div className="leading-tight">
                <ScrambleText text="Connect. Collaborate." className="opacity-90" />
                <br />
                <ScrambleText text="Conquer." delay={1000} className="font-extrabold text-glow-pink opacity-100" />
            </div>
        ),
        subheadline: "Build your team and distribute to the world.",
        cta: { label: "Join Network", href: "/signup" }
    },
    {
        id: 'artful-intelligence',
        content: (
            <div className="leading-tight">
                <ScrambleText text="Not Artificial." className="opacity-90" />
                <br />
                <ScrambleText text="Artful Intelligence." delay={800} className="font-extrabold text-glow-blue opacity-100" />
            </div>
        ),
        subheadline: "Intelligence that works for you, not against you.",
        cta: { label: "Explore Tools", href: "/signup" }
    }
];
