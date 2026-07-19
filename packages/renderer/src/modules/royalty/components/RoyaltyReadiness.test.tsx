import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { RoyaltyProfile } from '../types';
import { ActionPanel } from './ActionPanel';
import { MlcSection } from './MlcSection';
import { ReleaseGateBanner } from './ReleaseGateBanner';

const incompleteProfile: RoyaltyProfile = {
    id: 'profile-1',
    userId: 'owner-1',
    proRegistration: {
        status: 'not_started',
        selectedPro: null,
        songwriterRegistered: false,
        publisherRegistered: false,
        ipiNumber: null,
        applicationDate: null,
    },
    soundExchangeRegistration: {
        status: 'not_started',
        accountId: null,
        registrationDate: null,
        registeredTracks: 0,
    },
    mlcRegistration: {
        status: 'not_started',
        accountId: null,
        ipiNumberLinked: null,
        registeredWorks: 0,
    },
    copyrightRegistrations: [],
};

describe('royalty registration readiness', () => {
    it('describes unregistered collection channels as gaps, not a legal release block', () => {
        render(<ReleaseGateBanner profile={incompleteProfile} scrollToSection={vi.fn()} />);

        expect(screen.getByText(/Royalty collection gaps/i)).toBeInTheDocument();
        expect(screen.queryByText(/Release Blocked/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/cannot schedule an audio release/i)).not.toBeInTheDocument();
    });

    it('allows navigation while clearly showing incomplete royalty coverage', () => {
        render(<ActionPanel profile={incompleteProfile} onComplete={vi.fn()} />);

        expect(screen.getByRole('button', { name: /Go to Dashboard/i })).toBeEnabled();
        expect(screen.getByText(/Royalty coverage incomplete/i)).toBeInTheDocument();
    });

    it('does not hard-block MLC guidance solely because PRO registration is unfinished', () => {
        render(<MlcSection profile={incompleteProfile} isExpanded onToggle={vi.fn()} />);

        expect(screen.getByText(/Why the MLC matters/i)).toBeInTheDocument();
        expect(screen.queryByText(/Complete PRO registration first/i)).not.toBeInTheDocument();
    });
});
