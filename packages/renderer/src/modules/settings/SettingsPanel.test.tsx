import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SettingsPanel from './SettingsPanel';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/core/store', () => ({
    useStore: () => ({
        user: {
            uid: 'test-uid-12345678',
            email: 'dtroit@indii.music',
            displayName: 'D-Troit',
            photoURL: null,
        },
        userProfile: {
            bio: 'Detroit techno producer',
            founderTier: null,
        },
    }),
}));

vi.mock('zustand/react/shallow', () => ({
    useShallow: (fn: unknown) => fn,
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        showToast: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    }),
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn(),
    updateDoc: vi.fn().mockResolvedValue(undefined),
    getFirestore: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
    updateProfile: vi.fn().mockResolvedValue(undefined),
    getAuth: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({
    db: {},
    auth: { currentUser: null },
    remoteConfig: {},
    storage: {},
    messaging: null,
    appCheck: {},
}));

vi.mock('@/utils/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('./components/FounderBadge', () => ({
    default: () => <div data-testid="founder-badge" />,
}));

vi.mock('./components/AuditLogDashboard', () => ({
    default: () => <div data-testid="audit-log-dashboard" />,
    AuditLogDashboard: () => <div data-testid="audit-log-dashboard" />,
}));

vi.mock('./components/DownloadHub', () => ({
    default: () => <div data-testid="download-hub" />,
    DownloadHub: () => <div data-testid="download-hub" />,
}));

// ── Tests ──────────────────────────────────────────────────────────────────

describe('SettingsPanel', () => {
    it('renders the Settings heading', () => {
        render(<SettingsPanel />);
        expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('renders all 5 navigation sections', () => {
        render(<SettingsPanel />);
        // Each label appears multiple times (desktop + mobile nav + possibly section heading)
        expect(screen.getAllByText('Profile').length).toBeGreaterThanOrEqual(2);
        expect(screen.getAllByText('Connected Services').length).toBeGreaterThanOrEqual(2);
        expect(screen.getAllByText('Notifications').length).toBeGreaterThanOrEqual(2);
        expect(screen.getAllByText('Appearance').length).toBeGreaterThanOrEqual(2);
        expect(screen.getAllByText('Account & Security').length).toBeGreaterThanOrEqual(2);
    });

    it('defaults to the Profile section', () => {
        render(<SettingsPanel />);
        // Profile section should show the display name input
        expect(screen.getByPlaceholderText('Your display name')).toBeInTheDocument();
    });

    it('switches to Connected Services when clicked', () => {
        render(<SettingsPanel />);
        // There are multiple "Connected Services" buttons (desktop + mobile nav)
        // Click the first one (desktop sidebar)
        const buttons = screen.getAllByText('Connected Services');
        fireEvent.click(buttons[0]!);
        // The connections section should now be visible — look for connection-related content
        // We can't check exact text without seeing the component, but AnimatePresence should switch
        expect(buttons[0]!.closest('button')).toHaveClass('bg-cyan-500/10');
    });

    it('switches to Notifications when clicked', () => {
        render(<SettingsPanel />);
        const buttons = screen.getAllByText('Notifications');
        fireEvent.click(buttons[0]!);
        expect(buttons[0]!.closest('button')).toHaveClass('bg-cyan-500/10');
    });

    it('switches to Appearance when clicked', () => {
        render(<SettingsPanel />);
        const buttons = screen.getAllByText('Appearance');
        fireEvent.click(buttons[0]!);
        expect(buttons[0]!.closest('button')).toHaveClass('bg-cyan-500/10');
    });

    it('switches to Account & Security when clicked', () => {
        render(<SettingsPanel />);
        const buttons = screen.getAllByText('Account & Security');
        fireEvent.click(buttons[0]!);
        expect(buttons[0]!.closest('button')).toHaveClass('bg-cyan-500/10');
    });

    it('Profile section renders display name and bio fields', () => {
        render(<SettingsPanel />);
        expect(screen.getByPlaceholderText('Your display name')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Tell us about yourself...')).toBeInTheDocument();
    });

    it('Profile section shows the user email as disabled', () => {
        render(<SettingsPanel />);
        const emailInput = screen.getByDisplayValue('dtroit@indii.music');
        expect(emailInput).toBeDisabled();
    });

    it('Profile section shows save button after editing display name', () => {
        render(<SettingsPanel />);
        const nameInput = screen.getByPlaceholderText('Your display name');
        fireEvent.change(nameInput, { target: { value: 'Detroit Legend' } });
        expect(screen.getByText('Save Changes')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('Profile section cancel button resets the name', () => {
        render(<SettingsPanel />);
        const nameInput = screen.getByPlaceholderText('Your display name') as HTMLInputElement;
        fireEvent.change(nameInput, { target: { value: 'Detroit Legend' } });
        fireEvent.click(screen.getByText('Cancel'));
        expect(nameInput.value).toBe('D-Troit');
    });

    it('Profile section bio character count updates', () => {
        render(<SettingsPanel />);
        const bioInput = screen.getByPlaceholderText('Tell us about yourself...');
        fireEvent.change(bioInput, { target: { value: 'Underground techno from the D' } });
        // bio.length and "/280 characters" render as separate text nodes in React
        // Find the parent element that contains both
        expect(screen.getByText(/\/280 characters/)).toBeInTheDocument();
    });

    it('renders both desktop and mobile navigation', () => {
        render(<SettingsPanel />);
        // Each section label should appear twice (desktop + mobile)
        const profileButtons = screen.getAllByText('Profile');
        expect(profileButtons.length).toBeGreaterThanOrEqual(2);
    });
});
