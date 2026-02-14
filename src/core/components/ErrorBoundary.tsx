import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    moduleName?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

const CHUNK_RELOAD_KEY = 'app_last_chunk_error';
const RELOAD_THRESHOLD_MS = 10000; // 10 seconds

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Check if this is a chunk load error
        if (this.isChunkLoadError(error)) {
            const lastReload = sessionStorage.getItem(CHUNK_RELOAD_KEY);
            const now = Date.now();

            // If we haven't reloaded recently (within 10s), reload the page
            if (!lastReload || now - parseInt(lastReload) > RELOAD_THRESHOLD_MS) {
                console.warn('[ErrorBoundary] Detected chunk load error, reloading...');
                sessionStorage.setItem(CHUNK_RELOAD_KEY, now.toString());
                window.location.reload();
                return;
            } else {
                console.warn('[ErrorBoundary] Chunk load error persisted after reload.');
            }
        }

        console.error(`Uncaught error in ${this.props.moduleName || 'component'}:`, error, errorInfo);
    }

    private isChunkLoadError(error: Error): boolean {
        const message = error.message?.toLowerCase() || '';
        return (
            message.includes('failed to fetch dynamically imported module') ||
            message.includes('importing a module script failed') ||
            message.includes('error loading dynamically imported module')
        );
    }

    private handleReset = () => {
        const wasChunkError = this.state.error && this.isChunkLoadError(this.state.error);
        this.setState({ hasError: false, error: null });
        if (wasChunkError) {
            window.location.reload();
        }
    };

    private handleGoHome = () => {
        this.setState({ hasError: false, error: null });
        window.location.href = '/';
    };

    public render() {
        if (this.state.hasError) {
            const isChunkError = this.state.error && this.isChunkLoadError(this.state.error);

            if (this.props.fallback) return this.props.fallback;

            return (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-black/40 backdrop-blur-xl rounded-2xl border border-white/5 m-4 min-h-[400px]">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="relative mb-8"
                    >
                        <div className="absolute inset-0 bg-red-500/20 blur-3xl rounded-full" />
                        <div className="relative w-24 h-24 bg-gray-900 border border-red-500/30 rounded-3xl flex items-center justify-center text-red-500 shadow-2xl">
                            {isChunkError ? (
                                <RefreshCw size={48} strokeWidth={1.5} className="animate-spin-slow" />
                            ) : (
                                <AlertTriangle size={48} strokeWidth={1.5} />
                            )}
                        </div>
                    </motion.div>

                    <h2 className="text-3xl font-display font-bold mb-3 tracking-tight">
                        {isChunkError ? "Update Available" : "Module Crash Detected"}
                    </h2>
                    <p className="text-gray-400 max-w-md mb-10 leading-relaxed text-lg">
                        {isChunkError
                            ? "A new version of indiiOS has been deployed. Please refresh to continue using the latest features."
                            : `Something went wrong in the ${this.props.moduleName || 'requested'} module. Agent Zero has been notified and is investigating.`
                        }
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 items-center">
                        <button
                            onClick={this.handleReset}
                            className="flex items-center gap-3 px-8 py-4 bg-white text-black font-bold rounded-2xl hover:bg-gray-200 transition-all active:scale-95 shadow-xl shadow-white/5 text-lg"
                        >
                            <RefreshCw size={20} />
                            {isChunkError ? "Reload Now" : "Try Again"}
                        </button>

                        {!isChunkError && (
                            <button
                                onClick={this.handleGoHome}
                                className="flex items-center gap-3 px-8 py-4 bg-white/5 text-white font-bold rounded-2xl hover:bg-white/10 transition-all active:scale-95 border border-white/10 text-lg"
                            >
                                <Home size={20} />
                                Go to Dashboard
                            </button>
                        )}
                    </div>

                    {import.meta.env.DEV && this.state.error && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-16 w-full max-w-3xl p-6 bg-black/60 rounded-2xl border border-white/5 text-left overflow-hidden shadow-inner font-mono text-sm"
                        >
                            <p className="font-bold mb-3 uppercase tracking-[0.2em] text-[10px] text-gray-500">Developer Insights / Stack Trace</p>
                            <div className="max-h-64 overflow-auto custom-scrollbar text-red-300/80 scroll-p-2">
                                <p className="font-bold mb-2 text-red-400">{this.state.error.message}</p>
                                {this.state.error.stack}
                            </div>
                        </motion.div>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}
