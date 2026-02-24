import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '@/core/context/ToastContext';
import { ThemeProvider } from '@/core/context/ThemeContext';

interface WrapperProps {
    children: React.ReactNode;
}

const AllTheProviders = ({ children }: WrapperProps) => {
    return (
        <MemoryRouter>
            <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
                {typeof ToastProvider === 'function' ? (
                    <ToastProvider>
                        {children}
                    </ToastProvider>
                ) : (
                    children
                )}
            </ThemeProvider>
        </MemoryRouter>
    );
};

const customRender = (
    ui: ReactElement,
    options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: AllTheProviders, ...options });

export const createMockStore = (initialState: any = {}) => {
    return {
        ...initialState,
        // Common AppState defaults
        userProfile: initialState.userProfile || null,
        currentModuleId: initialState.currentModuleId || 'dashboard',
        showCommandBar: initialState.showCommandBar || false,
        // Provide dummy functions for unset methods to prevent calling undefined
        updateProfile: vi.fn(),
        setModule: vi.fn(),
        toggleCommandBar: vi.fn(),
        addToast: vi.fn(),
    };
};

export * from '@testing-library/react';
export { customRender as render };

