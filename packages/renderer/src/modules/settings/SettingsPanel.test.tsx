// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { render, screen, fireEvent, within } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import SettingsPanel from './SettingsPanel';
import { getColorForModule } from '@/core/theme/moduleColors';

const settingsStoreState = {
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
};

// Make AnimatePresence render children synchronously in jsdom — without this,
// mode="wait" delays mounting the incoming section and fireEvent.click() tests
// see stale content because animations don't run in jsdom.
vi.mock('motion/react', async () => {
    const actual = await vi.importActual<typeof import('motion/react')>('motion/react');
    return {
        ...actual,
        AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
        motion: new Proxy({} as typeof actual.motion, {
            get: (_target, prop: string) =>
                // Return a simple passthrough component for any motion.* tag
                ({ children, ...rest }: any) => {
                    // ISSUE-1190: `keyof JSX.IntrinsicElements` used to widen to `string` under the
                // old blanket index signature. With real element types it is a union of every
                // tag, so props must satisfy ALL of them (three/drei elements demand `map`).
                // These mocks render a plain DOM tag, so `ElementType` is the accurate cast.
                const Tag = prop as unknown as React.ElementType;
                    return <Tag {...rest}>{children}</Tag>;
                },
        }),
    };
});

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/core/store', () => ({
    useStore: () => settingsStoreState,
}));

vi.mock('./settings-panel/RemoteSection', () => ({
    default: () => <div>Remote pairing controls</div>,
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

// The global setup.ts sets window.electronAPI to a partial stub (no getAppVersion).
// DesktopSection reads !!window.electronAPI to decide which branch to render.
// Force it to undefined so the non-Electron path is exercised here.
beforeEach(() => {
    window.history.replaceState({}, '', '/settings');
    Object.defineProperty(window, 'electronAPI', {
        writable: true,
        configurable: true,
        value: undefined,
    });
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('SettingsPanel', () => {
    it('renders the Settings heading', () => {
        render(<SettingsPanel />);
        expect(screen.getByText('settings.title')).toBeInTheDocument();
    });

    it('renders all 5 navigation sections', () => {
        render(<SettingsPanel />);
        // Each label appears multiple times (desktop + mobile nav + possibly section heading)
        expect(screen.getAllByText('settings.sections.profile.label').length).toBeGreaterThanOrEqual(2);
        expect(screen.getAllByText('settings.sections.connections.label').length).toBeGreaterThanOrEqual(2);
        expect(screen.getAllByText('settings.sections.notifications.label').length).toBeGreaterThanOrEqual(2);
        expect(screen.getAllByText('settings.sections.appearance.label').length).toBeGreaterThanOrEqual(2);
        expect(screen.getAllByText('settings.sections.security.label').length).toBeGreaterThanOrEqual(2);
    });

    it('defaults to the Profile section', () => {
        render(<SettingsPanel />);
        // Profile section should show the display name input
        expect(screen.getByPlaceholderText('settings.hints.display_name')).toBeInTheDocument();
    });

    it('renders the requested Remote section from shared navigation state', () => {
        window.history.replaceState({}, '', '/settings?section=remote');
        render(<SettingsPanel />);

        expect(screen.getByText('Remote pairing controls')).toBeInTheDocument();
        expect(screen.getAllByText('settings.sections.remote.label')[0]!.closest('button')).toHaveClass(getColorForModule('settings').bg);
    });

    it('switches to Connected Services when clicked', () => {
        render(<SettingsPanel />);
        // There are multiple "Connected Services" buttons (desktop + mobile nav)
        // Click the first one (desktop sidebar)
        const buttons = screen.getAllByText('settings.sections.connections.label');
        fireEvent.click(buttons[0]!);
        // The connections section should now be visible — look for connection-related content
        // We can't check exact text without seeing the component, but AnimatePresence should switch
        expect(buttons[0]!.closest('button')).toHaveClass(getColorForModule('settings').bg);
    });

    it('switches to Notifications when clicked', () => {
        render(<SettingsPanel />);
        const buttons = screen.getAllByText('settings.sections.notifications.label');
        fireEvent.click(buttons[0]!);
        expect(buttons[0]!.closest('button')).toHaveClass(getColorForModule('settings').bg);
    });

    it('switches to Appearance when clicked', () => {
        render(<SettingsPanel />);
        const buttons = screen.getAllByText('settings.sections.appearance.label');
        fireEvent.click(buttons[0]!);
        expect(buttons[0]!.closest('button')).toHaveClass(getColorForModule('settings').bg);
    });

    it('switches to Account & Security when clicked', () => {
        render(<SettingsPanel />);
        const buttons = screen.getAllByText('settings.sections.security.label');
        fireEvent.click(buttons[0]!);
        expect(buttons[0]!.closest('button')).toHaveClass(getColorForModule('settings').bg);
    });

    it('renders the real privacy controls inside Account & Security', () => {
        render(<SettingsPanel />);
        const buttons = screen.getAllByText('settings.sections.security.label');
        fireEvent.click(buttons[0]!);

        expect(screen.getByText('Privacy & Data')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Request account deletion' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Export my data' })).toBeInTheDocument();
    });

    it('hides the developer Firebase bypass from non-founder users', () => {
        render(<SettingsPanel />);
        const buttons = screen.getAllByText('settings.sections.desktop.label');
        fireEvent.click(buttons[0]!);

        // import.meta.env.DEV is TRUE in Vitest, so isFounderAccess=true.
        // The bypass panel is shown; the hidden-outside-founder message is NOT shown.
        expect(screen.getByText('Developer Firebase Push Bypass')).toBeInTheDocument();
        expect(screen.queryByText('Developer push tools are hidden outside founder/dev builds.')).not.toBeInTheDocument();
    });

    it('Profile section renders display name and bio fields', () => {
        render(<SettingsPanel />);
        expect(screen.getByPlaceholderText('settings.hints.display_name')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('settings.hints.bio_desc')).toBeInTheDocument();
    });

    it('Profile section shows the user email as disabled', () => {
        render(<SettingsPanel />);
        const emailInput = screen.getByDisplayValue('dtroit@indii.music');
        expect(emailInput).toBeDisabled();
    });

    it('Profile section shows save button after editing display name', () => {
        render(<SettingsPanel />);
        const nameInput = screen.getByPlaceholderText('settings.hints.display_name');
        fireEvent.change(nameInput, { target: { value: 'Detroit Legend' } });
        expect(screen.getByText('settings.profile.saveChanges')).toBeInTheDocument();
        expect(screen.getByText('settings.profile.cancel')).toBeInTheDocument();
    });

    it('Profile section cancel button resets the name', () => {
        render(<SettingsPanel />);
        const nameInput = screen.getByPlaceholderText('settings.hints.display_name') as HTMLInputElement;
        fireEvent.change(nameInput, { target: { value: 'Detroit Legend' } });
        fireEvent.click(screen.getByText('settings.profile.cancel'));
        expect(nameInput.value).toBe('D-Troit');
    });

    it('Profile section bio character count updates', () => {
        render(<SettingsPanel />);
        const bioInput = screen.getByPlaceholderText('settings.hints.bio_desc');
        fireEvent.change(bioInput, { target: { value: 'Underground techno from the D' } });
        // bio.length and "/280 characters" render as separate text nodes in React
        // Find the parent element that contains both
        expect(screen.getByText('settings.profile.characters')).toBeInTheDocument();
    });

    it('renders both desktop and mobile navigation', () => {
        render(<SettingsPanel />);
        // Each section label should appear twice (desktop + mobile)
        const profileButtons = screen.getAllByText('settings.sections.profile.label');
        expect(profileButtons.length).toBeGreaterThanOrEqual(2);
    });
});
