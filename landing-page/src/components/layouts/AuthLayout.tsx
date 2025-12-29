import React from 'react';
import { useLocation } from 'react-router-dom';

interface AuthLayoutProps {
    children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
    // Replicating visual effects from the original layout
    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden font-sans">
             {/* Dynamic Background */}
             <div className="absolute inset-0 bg-void z-0" />

             {/* Gradient Glow */}
             <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-purple-900/20 rounded-full blur-[120px] pointer-events-none" />
             <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-blue-900/20 rounded-full blur-[120px] pointer-events-none" />

             {/* Grid Pattern */}
             <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-20 pointer-events-none" />

            {/* Content */}
            <div className="w-full max-w-md px-4 relative z-10">
                <div className="mb-8 text-center">
                    <a href="/" className="inline-block group">
                        <h1 className="text-3xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-400 group-hover:to-white transition-all">
                            indiiOS
                        </h1>
                    </a>
                </div>

                {children}
            </div>

            {/* Footer */}
            <div className="mt-8 text-center text-xs text-gray-600 relative z-10">
                <p>&copy; 2026 indiiOS Inc. All rights reserved.</p>
            </div>
        </div>
    );
}
