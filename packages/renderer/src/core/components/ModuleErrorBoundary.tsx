import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Zap } from 'lucide-react';
import { logger } from '@/utils/logger';
import { judgeCrashTriage, CrashTriageResult } from '@/config/typesafeJudgments';

interface Props {
    key?: React.Key;
    children: ReactNode;
    moduleName?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
    triage: CrashTriageResult | null;
}

export class ModuleErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        triage: null,
    };

    private _isMounted = false;
    private _retryTimer: ReturnType<typeof setTimeout> | null = null;

    public static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        const moduleName = this.props.moduleName || 'Module';
        logger.error(`[ModuleErrorBoundary] Error in ${moduleName}:`, error, errorInfo);

        // Auto-reload once for chunk load errors (Vite lazy loading failures)
        if (error.message && error.message.includes('Failed to fetch dynamically imported module')) {
            try {
                const hasReloaded = sessionStorage.getItem('chunk_load_error_reloaded');
                if (!hasReloaded) {
                    sessionStorage.setItem('chunk_load_error_reloaded', 'true');
                    window.location.reload();
                    return;
                }
            } catch {
                // Ignore sessionStorage failures in restricted environments
            }
        }

        // Fast-path Jev System One crash classification
        judgeCrashTriage({
            moduleName,
            errorMessage: error.message || 'Unknown runtime error',
            componentStack: errorInfo.componentStack || undefined,
        }).then((triage) => {
            if (triage && this._isMounted && this.state.hasError) {
                this.setState({ triage });
            }
        }).catch(() => {});
    }

    private handleRetry = () => {
        const action = this.state.triage?.recommendedAction;
        if (
            action === 'REFRESH_PAGE' ||
            (this.state.error?.message &&
                this.state.error.message.includes('Failed to fetch dynamically imported module'))
        ) {
            window.location.reload();
        } else if (action === 'RESET_LOCAL_CACHE') {
            try {
                sessionStorage.clear();
            } catch {
                // Ignore storage clear errors in restricted browsing environments
            }
            window.location.reload();
        } else {
            this.setState({ hasError: false, error: null, triage: null });
        }
    };

    public componentDidMount() {
        this._isMounted = true;
        // If we successfully mounted without error, clear the retry flag after a delay
        // to allow future navigation to recover from temporary network drops
        this._retryTimer = setTimeout(() => {
            try {
                sessionStorage.removeItem('chunk_load_error_reloaded');
            } catch {
                // Ignore storage errors
            }
        }, 2000);
    }

    public componentWillUnmount() {
        this._isMounted = false;
        if (this._retryTimer !== null) {
            clearTimeout(this._retryTimer);
            this._retryTimer = null;
        }
    }

    public render() {
        if (this.state.hasError) {
            const triage = this.state.triage;
            const guidance = triage?.userGuidance || 'An unexpected error occurred in this module.';
            const actionLabel = triage?.recommendedAction === 'REFRESH_PAGE'
                ? 'Reload Page'
                : triage?.recommendedAction === 'RESET_LOCAL_CACHE'
                ? 'Reset Cache & Reload'
                : 'Try Again';

            return (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-bg-dark text-white">
                    <div className="bg-red-900/20 p-4 rounded-full mb-4 relative">
                        <AlertTriangle className="w-12 h-12 text-red-500" />
                        {triage && (
                            <div className="absolute -bottom-1 -right-1 bg-emerald-500/20 border border-emerald-500/40 rounded-full p-1 text-emerald-400">
                                <Zap size={14} />
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                        <h2 className="text-xl font-bold">
                            {this.props.moduleName ? `${this.props.moduleName} paused` : 'Something went wrong'}
                        </h2>
                        {triage && (
                            <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded bg-white/10 text-gray-300 font-mono">
                                {triage.rootCause.replace(/_/g, ' ')}
                            </span>
                        )}
                    </div>

                    <p className="text-gray-300 mb-6 max-w-md text-sm leading-relaxed">
                        {guidance}
                    </p>

                    {this.state.error && (
                        <div className="bg-black/50 p-3 rounded text-xs font-mono text-red-300/80 mb-6 max-w-lg overflow-auto border border-white/5">
                            {this.state.error.message}
                        </div>
                    )}

                    <div className="flex items-center gap-3">
                        <button
                            onClick={this.handleRetry}
                            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-black rounded-xl font-black text-xs uppercase tracking-wider hover:bg-emerald-400 transition-all shadow-lg active:scale-95"
                        >
                            <RefreshCw size={14} />
                            {actionLabel}
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
