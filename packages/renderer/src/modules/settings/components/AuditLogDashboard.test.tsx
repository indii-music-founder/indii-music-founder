import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    collection: vi.fn(() => 'audit-collection'),
    where: vi.fn(() => 'owner-filter'),
    orderBy: vi.fn(() => 'timestamp-order'),
    limit: vi.fn(() => 'result-limit'),
    query: vi.fn(() => 'audit-query'),
    onSnapshot: vi.fn(),
    unsubscribe: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'owner-123' } },
    db: 'firestore-db',
}));

vi.mock('firebase/firestore', () => ({
    collection: mocks.collection,
    where: mocks.where,
    orderBy: mocks.orderBy,
    limit: mocks.limit,
    query: mocks.query,
    onSnapshot: mocks.onSnapshot,
    Timestamp: class Timestamp {},
}));

vi.mock('@/utils/safeUnsubscribe', () => ({
    safeUnsubscribe: (unsubscribe: () => void) => unsubscribe(),
}));

vi.mock('@/utils/logger', () => ({
    logger: { error: vi.fn() },
}));

import { AuditLogDashboard } from './AuditLogDashboard';

describe('AuditLogDashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.onSnapshot.mockImplementation((_query, next) => {
            next({
                docs: [{
                    id: 'audit-1',
                    data: () => ({
                        timestamp: '2026-08-15T12:00:00.000Z',
                        agentId: 'creative-director',
                        action: 'agent.tool.generate_image',
                        resourceId: 'agent/creative-director',
                        status: 'success',
                    }),
                }],
            });
            return mocks.unsubscribe;
        });
    });

    it('queries only the signed-in owner records required by Firestore rules', () => {
        render(<AuditLogDashboard />);

        expect(mocks.collection).toHaveBeenCalledWith('firestore-db', 'audit_logs');
        expect(mocks.where).toHaveBeenCalledWith('userId', '==', 'owner-123');
        expect(mocks.orderBy).toHaveBeenCalledWith('timestamp', 'desc');
        expect(mocks.limit).toHaveBeenCalledWith(100);
    });

    it('renders the immutable backend audit schema', () => {
        render(<AuditLogDashboard />);

        expect(screen.getByText('1 entries')).toBeInTheDocument();
        expect(screen.getByText('creative-director')).toBeInTheDocument();
        expect(screen.getByText('agent.tool.generate_image')).toBeInTheDocument();
        expect(screen.getByText('agent/creative-director')).toBeInTheDocument();
        expect(screen.getByText('success')).toBeInTheDocument();
        expect(screen.getByText(/Immutable, server-recorded audit events/)).toBeInTheDocument();
        expect(screen.queryByText(/all agent commands, API actions, and system events/)).not.toBeInTheDocument();
    });
});
