
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
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
