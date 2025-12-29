import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
    moduleName?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ModuleErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error(`[ModuleErrorBoundary] Error in ${this.props.moduleName || 'Module'}:`, error, errorInfo);
    }

    private handleRetry = () => {
        this.setState({ hasError: false, error: null });
        // Optional: Force reload or specialized recovery
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-[#0d1117] text-white">
                    <div className="bg-red-900/20 p-4 rounded-full mb-4">
                        <AlertTriangle className="w-12 h-12 text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
                    <p className="text-gray-400 mb-6 max-w-md">
                        {this.props.moduleName ? `${this.props.moduleName} encountered an error.` : 'An unexpected error occurred in this module.'}
                    </p>

                    {this.state.error && (
                        <div className="bg-black/50 p-3 rounded text-xs font-mono text-red-300 mb-6 max-w-lg overflow-auto">
                            {this.state.error.message}
                        </div>
                    )}

                    <button
                        onClick={this.handleRetry}
                        className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-gray-200 transition-colors"
                    >
                        <RefreshCw size={16} />
                        Try Again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
