import type { ReactNode } from 'react';
import { ToastProvider } from '@/core/context/ToastContext';
import { VoiceProvider } from '@/core/context/VoiceContext';

interface MobileRemoteProvidersProps {
    children: ReactNode;
}

/**
 * Providers needed by controller-only rooms.
 *
 * The standalone Controller bypasses AppShell, where these providers normally
 * live. Keeping the controller composition separate prevents duplicate
 * providers on every non-controller Studio route.
 */
export function MobileRemoteProviders({ children }: MobileRemoteProvidersProps) {
    return (
        <VoiceProvider>
            <ToastProvider>{children}</ToastProvider>
        </VoiceProvider>
    );
}
