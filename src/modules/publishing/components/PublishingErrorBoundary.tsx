/**
 * Publishing Module Error Boundary
 * Provides graceful error recovery for Publishing components
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    componentName?: string;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class PublishingErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return {
            hasError: true,
            error,
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        const { componentName, onError } = this.props;

        // Log to console
        console.error(
            `[PublishingErrorBoundary${componentName ? ` - ${componentName}` : ''}]`,
            error,
            errorInfo
        );

        // Send to error monitoring (Sentry, etc.)
        if (onError) {
            onError(error, errorInfo);
        }

        this.setState({
            error,
            errorInfo,
        });
    }

    handleReset = (): void => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    render(): ReactNode {
        const { hasError, error } = this.state;
        const { children, fallback, componentName } = this.props;

        if (hasError) {
            if (fallback) {
                return fallback;
            }

            return (
                <div className="flex items-center justify-center min-h-[400px] bg-[#0A0A0A] border border-red-900/30 rounded-2xl p-8">
                    <div className="text-center max-w-md">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 mb-4">
                            <AlertCircle className="w-8 h-8 text-red-500" />
                        </div>

                        <h3 className="text-xl font-bold text-white mb-2">
                            {componentName ? `${componentName} Error` : 'Something went wrong'}
                        </h3>

                        <p className="text-gray-400 text-sm mb-6">
                            {error?.message || 'An unexpected error occurred while loading this component.'}
                        </p>

                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={this.handleReset}
                                className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Try Again
                            </button>

                            <button
                                onClick={() => window.location.reload()}
                                className="px-6 py-3 bg-gray-800 text-white rounded-xl font-bold text-sm hover:bg-gray-700 transition-colors border border-gray-700"
                            >
                                Reload Page
                            </button>
                        </div>

                        {process.env.NODE_ENV === 'development' && error && (
                            <details className="mt-6 text-left">
                                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
                                    Error Details (Dev Only)
                                </summary>
                                <pre className="mt-2 p-4 bg-black/50 rounded-lg text-xs text-red-400 overflow-auto max-h-48">
                                    {error.stack}
                                </pre>
                            </details>
                        )}
                    </div>
                </div>
            );
        }

        return children;
    }
}
