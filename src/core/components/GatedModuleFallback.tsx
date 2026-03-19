import { Rocket, ArrowLeft } from 'lucide-react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { motion } from 'framer-motion';

/**
 * GatedModuleFallback — shown when a user navigates to a module that is
 * currently behind a feature flag. This replaces the module content with
 * a polished "Coming Soon" page instead of rendering placeholder/mock UIs.
 */
export function GatedModuleFallback({ moduleName }: { moduleName: string }) {
    const { setModule } = useStore(useShallow(s => ({ setModule: s.setModule })));

    const displayName = moduleName
        .replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());

    return (
        <div className="flex items-center justify-center h-full px-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="flex flex-col items-center gap-6 text-center max-w-md"
            >
                {/* Animated rocket icon */}
                <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-600/20 to-indigo-600/20 border border-purple-500/20 flex items-center justify-center"
                >
                    <Rocket size={36} className="text-purple-400" />
                </motion.div>

                <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-gray-100">
                        {displayName}
                    </h2>
                    <p className="text-gray-400 text-sm leading-relaxed">
                        This module is currently in development and will be available in an upcoming release.
                        We're building something special — stay tuned.
                    </p>
                </div>

                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20">
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                    <span className="text-xs font-medium text-purple-300">In Development</span>
                </div>

                <button
                    onClick={() => setModule('dashboard')}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-gray-300 hover:text-white transition-all"
                >
                    <ArrowLeft size={14} />
                    Back to Dashboard
                </button>
            </motion.div>
        </div>
    );
}
