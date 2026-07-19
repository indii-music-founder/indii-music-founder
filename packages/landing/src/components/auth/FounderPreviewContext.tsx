'use client';

import React from 'react';

const MODULES = ['Boardroom', 'Creative', 'Video', 'Distribution', 'Finance', 'Legal'];

function useFounderSource() {
    return typeof window !== 'undefined' &&
        (window.location.search.includes('source=founder') ||
         window.location.hostname.startsWith('founder'));
}

export default function FounderPreviewContext({ variant }: { variant: 'login' | 'signup' }) {
    const isFounderSource = useFounderSource();

    if (!isFounderSource) return null;

    return (
        <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 sm:p-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-black/30 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                Founder Preview
            </div>
            <p className="mt-4 text-sm leading-6 text-gray-200">
                {variant === 'login'
                    ? 'Guided walkthrough entry. Sign in to meet the Conductor and move into the private preview.'
                    : 'Private launch access. Create the preview account to enter the guided walkthrough and start testing the full platform.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
                {MODULES.map((moduleName) => (
                    <span
                        key={moduleName}
                        className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-gray-300"
                    >
                        {moduleName}
                    </span>
                ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-gray-500">
                After sign-in: guided walkthrough, Boardroom access, and the founder preview path.
            </p>
        </section>
    );
}
