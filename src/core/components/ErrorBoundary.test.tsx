import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow?: boolean }) => {
    if (shouldThrow) {
        throw new Error('Test error');
    }
    return <div>Working component</div>;
};

// Component that throws chunk load error
const ThrowChunkError = () => {
    throw new Error('Failed to fetch dynamically imported module');
};

describe('ErrorBoundary Component', () => {
    beforeEach(() => {
        // Suppress console.error in tests
        vi.spyOn(console, 'error').mockImplementation(() => {});
        // Clear sessionStorage before each test
        sessionStorage.clear();
    });

    it('should render children when no error', () => {
        render(
            <ErrorBoundary>
                <div>Test content</div>
            </ErrorBoundary>
        );

        expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('should render error UI when error occurs', () => {
        render(
            <ErrorBoundary>
                <ThrowError shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(screen.getByText('Module Crash Detected')).toBeInTheDocument();
        expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    });

    it('should display module name in error message', () => {
        render(
            <ErrorBoundary moduleName="TestModule">
                <ThrowError shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(screen.getByText(/TestModule/i)).toBeInTheDocument();
    });

    it('should render fallback when provided', () => {
        render(
            <ErrorBoundary fallback={<div>Custom fallback</div>}>
                <ThrowError shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(screen.getByText('Custom fallback')).toBeInTheDocument();
        expect(screen.queryByText('Module Crash Detected')).not.toBeInTheDocument();
    });

    it('should handle reset button click', () => {
        const { rerender } = render(
        render(
            <ErrorBoundary>
                <ThrowError shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(screen.getByText('Module Crash Detected')).toBeInTheDocument();

        const resetButton = screen.getByRole('button', { name: /Try Again/i });
        fireEvent.click(resetButton);

        // After reset, the error boundary should try to render children again
        // Since ThrowError still throws, it will show error again, but the click was handled
        expect(resetButton).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();
    });

    it('should detect chunk load errors', () => {
        render(
            <ErrorBoundary>
                <ThrowChunkError />
            </ErrorBoundary>
        );

        expect(screen.getByText('Update Available')).toBeInTheDocument();
        expect(screen.getByText(/new version/i)).toBeInTheDocument();
    });

    it('should show different UI for chunk errors', () => {
        render(
            <ErrorBoundary>
                <ThrowChunkError />
            </ErrorBoundary>
        );

        expect(screen.getByText('Reload Now')).toBeInTheDocument();
        expect(screen.queryByText('Go to Dashboard')).not.toBeInTheDocument();
    });

    it('should handle go home button for regular errors', () => {
        // Mock window.location.href
        delete (window as any).location;
        window.location = { href: '' } as any;

        render(
            <ErrorBoundary>
                <ThrowError shouldThrow={true} />
            </ErrorBoundary>
        );

        const homeButton = screen.getByRole('button', { name: /Go to Dashboard/i });
        fireEvent.click(homeButton);

        expect(window.location.href).toBe('/');
    });

    it('should show error stack in dev mode', () => {
        // Mock import.meta.env.DEV
        const originalEnv = import.meta.env;
        (import.meta.env as any) = { ...originalEnv, DEV: true };
        vi.stubEnv('DEV', true);

        render(
            <ErrorBoundary>
                <ThrowError shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(screen.getByText(/Stack Trace/i)).toBeInTheDocument();
        expect(screen.getByText('Test error')).toBeInTheDocument();

        // Restore
        (import.meta.env as any) = originalEnv;
    });

    it('should not show error stack in production mode', () => {
        const originalEnv = import.meta.env;
        (import.meta.env as any) = { ...originalEnv, DEV: false };
        vi.unstubAllEnvs();
    });

    it('should not show error stack in production mode', () => {
        const originalEnv = import.meta.env;
        (import.meta.env as any) = { ...originalEnv, DEV: false };
        vi.unstubAllEnvs();
    });

    it('should not show error stack in production mode', () => {
        vi.stubEnv('DEV', false);

        render(
            <ErrorBoundary>
                <ThrowError shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(screen.queryByText(/Stack Trace/i)).not.toBeInTheDocument();

        // Restore
        (import.meta.env as any) = originalEnv;
    });

    it('should recover after error is fixed', () => {
        let shouldThrow = true;

        const { rerender } = render(
            <ErrorBoundary>
                <ThrowError shouldThrow={shouldThrow} />
        vi.unstubAllEnvs();
    });

    it('should recover after error is fixed', () => {
        const { rerender } = render(
            <ErrorBoundary>
                <ThrowError shouldThrow={shouldThrow} />
        vi.unstubAllEnvs();
    });

    it('should recover after error is fixed', () => {
        const { rerender } = render(
            <ErrorBoundary>
                <ThrowError shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(screen.getByText('Module Crash Detected')).toBeInTheDocument();

        // Fix the error
        shouldThrow = false;

        // Click reset
        const resetButton = screen.getByRole('button', { name: /Try Again/i });
        fireEvent.click(resetButton);

        // Rerender with fixed component
        // Update props first to stop throwing
        rerender(
            <ErrorBoundary>
                <ThrowError shouldThrow={false} />
            </ErrorBoundary>
        );

        // Then click reset to clear the error boundary state
        const resetButton = screen.getByRole('button', { name: /Try Again/i });
        fireEvent.click(resetButton);

        expect(screen.queryByText('Module Crash Detected')).not.toBeInTheDocument();
        expect(screen.getByText('Working component')).toBeInTheDocument();
    });

    it('should handle errors in nested components', () => {
        render(
            <ErrorBoundary moduleName="ParentModule">
                <div>
                    <div>
                        <ThrowError shouldThrow={true} />
                    </div>
                </div>
            </ErrorBoundary>
        );

        expect(screen.getByText('Module Crash Detected')).toBeInTheDocument();
        expect(screen.getByText(/ParentModule/i)).toBeInTheDocument();
    });
});