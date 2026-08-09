import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { HealthPanel } from './HealthPanel';

vi.mock('@/services/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(() => 'health-collection'),
    limit: vi.fn(() => 'health-limit'),
    query: vi.fn(() => 'health-query'),
    getDocs: vi.fn(async () => ({ docs: [] })),
}));
vi.mock('@/services/agent/WebSocketControlPlane', () => ({
    wcpInstance: { connectionState: 'connected' },
}));

describe('HealthPanel', () => {
    it('marks an unimplemented Firebase AI probe unavailable instead of healthy', async () => {
        render(<HealthPanel />);

        await waitFor(() => expect(screen.getByText('System Unavailable')).toBeInTheDocument());
        expect(screen.getByText('Firebase AI')).toBeInTheDocument();
        expect(screen.getByText('No authenticated provider probe is implemented; health is not verified.')).toBeInTheDocument();
    });
});
