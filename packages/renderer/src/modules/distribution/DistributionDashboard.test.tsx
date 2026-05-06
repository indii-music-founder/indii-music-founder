import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DistributionDashboard from './DistributionDashboard';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('./hooks/useDistributionDashboard', () => ({
    useDistributionDashboard: () => ({
        releases: [
            {
                id: 'release-001',
                title: 'Motor City Underground',
                artist: 'D-Troit',
                status: 'delivered',
                format: 'single',
                createdAt: '2026-04-01T00:00:00Z',
            },
            {
                id: 'release-002',
                title: 'Detroit Revival EP',
                artist: 'D-Troit',
                status: 'pending',
                format: 'ep',
                createdAt: '2026-05-01T00:00:00Z',
            },
        ],
        loading: false,
        error: null,
        handleRetry: vi.fn(),
    }),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                'distribution.title': 'Distribution',
                'distribution.subtitle': 'Sovereign Command',
                'distribution.tabs.new': 'New Release',
                'distribution.tabs.catalogue': 'Catalogue',
                'distribution.tabs.analytics': 'Analytics',
                'distribution.tabs.transmissions': 'Transmissions',
            };
            return translations[key] || key;
        },
    }),
}));

vi.mock('@/core/components/ModuleErrorBoundary', () => ({
    ModuleErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./components/DistributorConnectionsPanel', () => ({
    DistributorConnectionsPanel: () => <div data-testid="distributor-connections-panel">Connections</div>,
}));
vi.mock('./components/BankPanel', () => ({
    BankPanel: () => <div data-testid="bank-panel">Bank Panel</div>,
}));
vi.mock('./components/AuthorityPanel', () => ({
    AuthorityPanel: () => <div data-testid="authority-panel">Authority Panel</div>,
}));
vi.mock('./components/QCPanel', () => ({
    QCPanel: () => <div data-testid="qc-panel">QC Panel</div>,
}));
vi.mock('./components/KeysPanel', () => ({
    KeysPanel: () => <div data-testid="keys-panel">Keys Panel</div>,
}));
vi.mock('./components/TransferPanel', () => ({
    TransferPanel: () => <div data-testid="transfer-panel">Transfer Panel</div>,
}));
vi.mock('./components/QCVisualizer', () => ({
    QCVisualizer: () => <div data-testid="qc-visualizer">QC Visualizer</div>,
}));
vi.mock('./components/ReleasesContent', () => ({
    ReleasesContent: ({ releases, loading, error }: any) => (
        <div data-testid="releases-content">
            {loading && <span>Loading releases...</span>}
            {error && <span>Error: {error}</span>}
            {releases?.map((r: any) => (
                <div key={r.id} data-testid={`release-${r.id}`}>{r.title}</div>
            ))}
        </div>
    ),
}));
vi.mock('./components/DistributorQuickView', () => ({
    DistributorQuickView: () => <div data-testid="distributor-quick-view">Quick View</div>,
}));
vi.mock('./components/DeliveryHealthPanel', () => ({
    DeliveryHealthPanel: ({ releases }: any) => (
        <div data-testid="delivery-health-panel">Health ({releases?.length} releases)</div>
    ),
}));
vi.mock('./components/QuickLinksPanel', () => ({
    QuickLinksPanel: () => <div data-testid="quick-links-panel">Quick Links</div>,
}));
vi.mock('./components/QCQuickPanel', () => ({
    QCQuickPanel: () => <div data-testid="qc-quick-panel">QC Quick</div>,
}));
vi.mock('./components/KeysStatusPanel', () => ({
    KeysStatusPanel: () => <div data-testid="keys-status-panel">Keys Status</div>,
}));
vi.mock('./components/AuthorityInfoPanel', () => ({
    AuthorityInfoPanel: () => <div data-testid="authority-info-panel">Authority Info</div>,
}));
vi.mock('./components/RegistrationChecklistPanel', () => ({
    RegistrationChecklistPanel: () => <div data-testid="registration-checklist-panel">Registration Checklist</div>,
}));

// ── Tests ──────────────────────────────────────────────────────────────────

describe('DistributionDashboard', () => {
    it('renders the dashboard with data-testid', () => {
        render(<DistributionDashboard />);
        expect(screen.getByTestId('distribution-dashboard')).toBeInTheDocument();
    });

    it('renders the title and subtitle', () => {
        render(<DistributionDashboard />);
        expect(screen.getByText('Distribution')).toBeInTheDocument();
        expect(screen.getByText('Sovereign Command')).toBeInTheDocument();
    });

    it('renders the Live System badge', () => {
        render(<DistributionDashboard />);
        expect(screen.getByTestId('live-system-badge')).toBeInTheDocument();
        expect(screen.getByText('Live System')).toBeInTheDocument();
    });

    it('renders all 7 tabs', () => {
        render(<DistributionDashboard />);
        expect(screen.getByTestId('distro-tab-new')).toBeInTheDocument();
        expect(screen.getByTestId('distro-tab-catalogue')).toBeInTheDocument();
        expect(screen.getByTestId('distro-tab-bank')).toBeInTheDocument();
        expect(screen.getByTestId('distro-tab-authority')).toBeInTheDocument();
        expect(screen.getByTestId('distro-tab-keys')).toBeInTheDocument();
        expect(screen.getByTestId('distro-tab-brain')).toBeInTheDocument();
        expect(screen.getByTestId('distro-tab-transmission')).toBeInTheDocument();
    });

    it('defaults to the Releases tab content', () => {
        render(<DistributionDashboard />);
        expect(screen.getByTestId('releases-content')).toBeInTheDocument();
        expect(screen.getByText('Motor City Underground')).toBeInTheDocument();
        expect(screen.getByText('Detroit Revival EP')).toBeInTheDocument();
    });

    it('switches to Catalogue tab when clicked', () => {
        render(<DistributionDashboard />);
        fireEvent.click(screen.getByTestId('distro-tab-catalogue'));
        expect(screen.getByTestId('distributor-connections-panel')).toBeInTheDocument();
    });

    it('switches to Analytics/Bank tab when clicked', () => {
        render(<DistributionDashboard />);
        fireEvent.click(screen.getByTestId('distro-tab-bank'));
        expect(screen.getByTestId('bank-panel')).toBeInTheDocument();
    });

    it('switches to Authority tab when clicked', () => {
        render(<DistributionDashboard />);
        fireEvent.click(screen.getByTestId('distro-tab-authority'));
        expect(screen.getByTestId('authority-panel')).toBeInTheDocument();
    });

    it('switches to Keys tab when clicked', () => {
        render(<DistributionDashboard />);
        fireEvent.click(screen.getByTestId('distro-tab-keys'));
        expect(screen.getByTestId('keys-panel')).toBeInTheDocument();
    });

    it('switches to Brain (QC) tab when clicked', () => {
        render(<DistributionDashboard />);
        fireEvent.click(screen.getByTestId('distro-tab-brain'));
        expect(screen.getByTestId('qc-panel')).toBeInTheDocument();
        expect(screen.getByTestId('qc-visualizer')).toBeInTheDocument();
    });

    it('switches to Transmission tab when clicked', () => {
        render(<DistributionDashboard />);
        fireEvent.click(screen.getByTestId('distro-tab-transmission'));
        expect(screen.getByTestId('transfer-panel')).toBeInTheDocument();
    });

    it('renders left sidebar panels (three-panel layout)', () => {
        render(<DistributionDashboard />);
        expect(screen.getByTestId('distributor-quick-view')).toBeInTheDocument();
        expect(screen.getByTestId('delivery-health-panel')).toBeInTheDocument();
        expect(screen.getByTestId('quick-links-panel')).toBeInTheDocument();
    });

    it('renders right sidebar panels', () => {
        render(<DistributionDashboard />);
        expect(screen.getByTestId('registration-checklist-panel')).toBeInTheDocument();
        expect(screen.getByTestId('qc-quick-panel')).toBeInTheDocument();
        expect(screen.getByTestId('keys-status-panel')).toBeInTheDocument();
        expect(screen.getByTestId('authority-info-panel')).toBeInTheDocument();
    });

    it('passes releases data to DeliveryHealthPanel', () => {
        render(<DistributionDashboard />);
        expect(screen.getByText('Health (2 releases)')).toBeInTheDocument();
    });
});
