
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
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

        console.error("Uncaught error:", error, errorInfo);
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
                <div className="p-6 bg-red-900/20 border border-red-500 rounded-lg text-white m-4" style={{ backgroundColor: 'rgba(50, 0, 0, 0.9)', color: 'white', padding: '20px', zIndex: 999999, position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', overflow: 'auto' }}>
                    <h2 className="text-xl font-bold mb-2">Something went wrong.</h2>
                    <p className="font-mono text-sm text-red-200 mb-4">
                        {this.state.error?.message}
                    </p>
                    <pre className="text-xs mb-4 overflow-auto max-h-96">
                        {this.state.error?.stack}
                    </pre>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded text-sm font-bold"
                        style={{ backgroundColor: 'red', color: 'white', padding: '10px 20px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                    >
                        Reload Application
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
