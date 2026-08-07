import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgentEncryptionPane } from './AgentEncryptionPane';
import { e2eEncryptionService } from '@/services/security/E2EEncryptionService';

describe('AgentEncryptionPane', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('shows empty state when no swarm keys are registered', () => {
        vi.spyOn(e2eEncryptionService, 'getDiagnostics').mockReturnValue({
            localAgentIds: [],
            registeredPeerIds: [],
            peersWithVerifiedSigning: [],
            activeSessionCount: 0,
        });

        render(<AgentEncryptionPane />);
        expect(screen.getByText(/No Active Swarm Sessions/)).toBeDefined();
    });

    it('badges a peer as signed only when it has a verified signing key, not merely a local one', () => {
        vi.spyOn(e2eEncryptionService, 'getDiagnostics').mockReturnValue({
            localAgentIds: ['self-agent'],
            registeredPeerIds: ['peer-signed', 'peer-unsigned'],
            peersWithVerifiedSigning: ['peer-signed'],
            activeSessionCount: 2,
        });

        render(<AgentEncryptionPane />);

        const signedRow = screen.getByText('peer-signed').closest('div');
        const unsignedRow = screen.getByText('peer-unsigned').closest('div');

        expect(signedRow?.textContent).toContain('signed');
        expect(unsignedRow?.textContent).toContain('unsigned');
    });

    it('renders diagnostic counts from the service snapshot', () => {
        vi.spyOn(e2eEncryptionService, 'getDiagnostics').mockReturnValue({
            localAgentIds: ['self-agent', 'router-agent'],
            registeredPeerIds: ['peer-a', 'peer-b', 'peer-c'],
            peersWithVerifiedSigning: ['peer-a'],
            activeSessionCount: 4,
        });

        render(<AgentEncryptionPane />);

        expect(screen.getByText('2')).toBeDefined(); // Local key pairs
        expect(screen.getByText('3')).toBeDefined(); // Registered peers
        expect(screen.getByText('1')).toBeDefined(); // Peers with verified signing
        expect(screen.getByText('4')).toBeDefined(); // Active session keys
    });
});
