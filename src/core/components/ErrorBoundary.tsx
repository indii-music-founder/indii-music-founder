
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { logger } from '@/utils/logger';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorId?: string;
}

const CHUNK_RELOAD_KEY = 'app_last_chunk_error';
const RELOAD_THRESHOLD_MS = 10000; // 10 seconds

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorId: undefined
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorId: crypto.randomUUID().slice(0, 8) };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Check if this is a chunk load error
        if (this.isChunkLoadError(error)) {
            const lastReload = sessionStorage.getItem(CHUNK_RELOAD_KEY);
            const now = Date.now();

            // If we haven't reloaded recently (within 10s), reload the page
            if (!lastReload || now - parseInt(lastReload) > RELOAD_THRESHOLD_MS) {
                logger.warn('[ErrorBoundary] Detected chunk load error, reloading...');
                sessionStorage.setItem(CHUNK_RELOAD_KEY, now.toString());
                window.location.reload();
                return;
            } else {
                logger.warn('[ErrorBoundary] Chunk load error persisted after reload.');
            }
        }

        logger.error(`[ErrorBoundary] Uncaught error (${this.state.errorId}):`, error, errorInfo);
    }

    private isChunkLoadError(error: Error): boolean {
        const message = error.message?.toLowerCase() || '';
        return (
            message.includes('failed to fetch dynamically imported module') ||
            message.includes('importing a module script failed') ||
            message.includes('error loading dynamically imported module')
        );
    }

    public render() {
        if (this.state.hasError) {
            // Specialized UI for persistent Chunk Load Errors (Loop detected)
            if (this.state.error && this.isChunkLoadError(this.state.error)) {
                return (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background text-white p-6">
                        <div className="max-w-md text-center">
                            <h2 className="text-2xl font-bold mb-4">New Version Available</h2>
                            <p className="text-gray-400 mb-8">
                                A new version of the application has been deployed. Please refresh your browser to get the latest updates.
                            </p>
                            <button
                                onClick={() => window.location.reload()}
                                className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 rounded-lg font-medium transition-colors bg-white text-black"
                            >
                                <RefreshCw size={18} />
                                Update Now
                            </button>
                        </div>
                    </div>
                );
            }

            // Standard Error Fallback
            return this.props.fallback || (
                <div className="fixed inset-0 z-[999999] p-6 bg-[rgba(50,0,0,0.9)] text-white overflow-auto flex items-center justify-center">
                    <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 max-w-2xl w-full text-center">
                        <div className="bg-red-900/30 p-4 rounded-full inline-block mb-4">
                            <RefreshCw className="w-10 h-10 text-red-400" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
                        <p className="text-gray-300 mb-6">
                            An unexpected error occurred. You can try reloading, or go back to the dashboard.
                        </p>
                        {import.meta.env.DEV && this.state.error ? (
                            <>
                                <p className="font-mono text-sm text-red-200 mb-2 text-left">
                                    {this.state.error.message}
                                </p>
                                <pre className="text-xs mb-4 overflow-auto max-h-64 bg-black/50 p-4 rounded border border-red-500/30 text-left">
                                    {this.state.error.stack}
                                </pre>
                            </>
                        ) : (
                            <p className="font-mono text-sm text-gray-400 mb-6">
                                Reference Code: {this.state.errorId}
                            </p>
                        )}
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => {
                                    this.setState({ hasError: false, error: null });
                                    window.location.hash = '';
                                    window.location.reload();
                                }}
                                className="px-5 py-2.5 bg-red-600 hover:bg-red-500 rounded-md text-sm font-bold text-white transition-colors cursor-pointer shadow-lg hover:shadow-red-500/20 inline-flex items-center gap-2"
                            >
                                <RefreshCw size={16} />
                                Reload Application
                            </button>
                            <button
                                onClick={() => {
                                    this.setState({ hasError: false, error: null });
                                    window.location.href = '/';
                                }}
                                className="px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-md text-sm font-bold text-white transition-colors cursor-pointer"
                            >
                                Go to Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
