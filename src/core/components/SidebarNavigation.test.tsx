import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Sidebar from './Sidebar';
import App from '../App';
import { useStore } from '../store';

// Mock the store
vi.mock('../store', () => ({
    useStore: vi.fn(),
}));

// Mock ToastContext
vi.mock('../context/ToastContext', () => ({
    ToastProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    }),
}));

// Mock Lazy Loaded Components
vi.mock('@/modules/marketing/components/BrandManager', () => ({ default: () => <div data-testid="brand-manager">Brand Manager</div> }));
vi.mock('@/modules/marketing/components/CampaignDashboard', () => ({ default: () => <div data-testid="campaign-dashboard">Campaign Dashboard</div> }));
vi.mock('@/modules/publicist/PublicistDashboard', () => ({ default: () => <div data-testid="publicist-dashboard">Publicist Dashboard</div> }));
vi.mock('@/modules/publishing/PublishingDashboard', () => ({ default: () => <div data-testid="publishing-dashboard">Publishing Dashboard</div> }));
vi.mock('@/modules/finance/FinanceDashboard', () => ({ default: () => <div data-testid="finance-dashboard">Finance Dashboard</div> }));
vi.mock('@/modules/licensing/LicensingDashboard', () => ({ default: () => <div data-testid="licensing-dashboard">Licensing Dashboard</div> }));
vi.mock('@/modules/touring/RoadManager', () => ({ default: () => <div data-testid="road-manager">Road Manager</div> }));
vi.mock('@/modules/social/SocialDashboard', () => ({ default: () => <div data-testid="social-dashboard">Social Dashboard</div> }));
vi.mock('@/modules/creative/CreativeStudio', () => ({ default: () => <div data-testid="creative-studio">Creative Studio</div> }));
vi.mock('@/modules/legal/LegalDashboard', () => ({ default: () => <div data-testid="legal-dashboard">Legal Dashboard</div> }));
vi.mock('@/modules/music/MusicStudio', () => ({ default: () => <div data-testid="music-studio">Music Analysis</div> }));
vi.mock('@/modules/video/VideoStudio', () => ({ default: () => <div data-testid="video-studio">Video Studio</div> }));
vi.mock('@/modules/workflow/WorkflowLab', () => ({ default: () => <div data-testid="workflow-lab">Workflow Lab</div> }));
vi.mock('@/modules/dashboard/Dashboard', () => ({ default: () => <div data-testid="dashboard">Dashboard</div> }));
vi.mock('@/modules/knowledge/KnowledgeBase', () => ({ default: () => <div data-testid="knowledge-base">Knowledge Base</div> }));
vi.mock('@/modules/auth/SelectOrg', () => ({ default: () => <div data-testid="select-org">Select Org</div> }));

// Mock other components used in App
vi.mock('./CommandBar', () => ({ default: () => <div data-testid="command-bar">Command Bar</div> }));
vi.mock('./AgentWindow', () => ({ default: () => <div data-testid="agent-window">Agent Window</div> }));
vi.mock('./RightPanel', () => ({ default: () => <div data-testid="right-panel">Right Panel</div> }));
vi.mock('./MobileNav', () => ({ MobileNav: () => <div data-testid="mobile-nav">Mobile Nav</div> }));
vi.mock('./ApiKeyErrorModal', () => ({ ApiKeyErrorModal: () => <div data-testid="api-key-error">Api Key Error</div> }));

describe('Sidebar Navigation Integration', () => {
    const mockSetModule = vi.fn();
    const mockInitializeAuth = vi.fn();
    const mockInitializeHistory = vi.fn();
    const mockLoadProjects = vi.fn();
    const mockToggleSidebar = vi.fn();

    const buildStoreState = (overrides: Record<string, unknown> = {}) => ({
        currentModule: 'dashboard',
        setModule: mockSetModule,
        isSidebarOpen: true,
        toggleSidebar: mockToggleSidebar,
        initializeAuth: mockInitializeAuth,
        initializeHistory: mockInitializeHistory,
        loadProjects: mockLoadProjects,
        isAuthReady: true,
        isAuthenticated: true,
        ...overrides,
    });

    beforeEach(() => {
        vi.clearAllMocks();
        const storeState = buildStoreState();
        (useStore as any).mockReturnValue(storeState);
        // Mock setState and getState on the store object itself for App.tsx direct usage
        (useStore as any).setState = vi.fn();
        (useStore as any).getState = vi.fn().mockReturnValue(storeState);
    });

    it('renders all sidebar items', () => {
        render(<Sidebar />);

        expect(screen.getByText('Brand Manager')).toBeInTheDocument();
        expect(screen.getByText('Road Manager')).toBeInTheDocument();
        expect(screen.getByText('Campaign Manager')).toBeInTheDocument();
        expect(screen.getByText('Publicist')).toBeInTheDocument();
        expect(screen.getByText('Marketing Department')).toBeInTheDocument();
        expect(screen.getByText('Social Media Department')).toBeInTheDocument();
        expect(screen.getByText('Legal Department')).toBeInTheDocument();
        expect(screen.getByText('Publishing Department')).toBeInTheDocument();
        expect(screen.getByText('Finance Department')).toBeInTheDocument();
        expect(screen.getByText('Licensing Department')).toBeInTheDocument();
    });

    it('calls setModule when a sidebar item is clicked', () => {
        render(<Sidebar />);

        fireEvent.click(screen.getByText('Brand Manager'));
        expect(mockSetModule).toHaveBeenCalledWith('brand');

        fireEvent.click(screen.getByText('Publicist'));
        expect(mockSetModule).toHaveBeenCalledWith('publicist');

        fireEvent.click(screen.getByText('Finance Department'));
        expect(mockSetModule).toHaveBeenCalledWith('finance');
    });

    it('renders correct dashboard for Brand Manager', async () => {
        (useStore as any).mockReturnValue({
            ...buildStoreState(),
            currentModule: 'brand',
        });

        render(<App />);

        await waitFor(() => {
            expect(screen.getByTestId('brand-manager')).toBeInTheDocument();
        });
    });

    it('renders correct dashboard for Campaign Manager', async () => {
        (useStore as any).mockReturnValue({
            ...buildStoreState(),
            currentModule: 'campaign',
        });

        render(<App />);

        await waitFor(() => {
            expect(screen.getByTestId('campaign-dashboard')).toBeInTheDocument();
        });
    });

    it('renders correct dashboard for Publicist', async () => {
        (useStore as any).mockReturnValue({
            ...buildStoreState(),
            currentModule: 'publicist',
        });

        render(<App />);

        await waitFor(() => {
            expect(screen.getByTestId('publicist-dashboard')).toBeInTheDocument();
        });
    });

    it('renders correct dashboard for Publishing', async () => {
        (useStore as any).mockReturnValue({
            ...buildStoreState(),
            currentModule: 'publishing',
        });

        render(<App />);

        await waitFor(() => {
            expect(screen.getByTestId('publishing-dashboard')).toBeInTheDocument();
        });
    });

    it('renders correct dashboard for Finance', async () => {
        (useStore as any).mockReturnValue({
            ...buildStoreState(),
            currentModule: 'finance',
        });

        render(<App />);

        await waitFor(() => {
            expect(screen.getByTestId('finance-dashboard')).toBeInTheDocument();
        });
    });

    it('renders correct dashboard for Licensing', async () => {
        (useStore as any).mockReturnValue({
            ...buildStoreState(),
            currentModule: 'licensing',
        });

        render(<App />);

        await waitFor(() => {
            expect(screen.getByTestId('licensing-dashboard')).toBeInTheDocument();
        });
    });

    it('renders user profile and logout button', () => {
        const mockLogout = vi.fn();
        (useStore as any).mockReturnValue({
            ...buildStoreState(),
            user: {
                displayName: 'Test User',
                email: 'test@example.com'
            },
            userProfile: {
                id: 'test-uid',
                displayName: 'Test User',
                email: 'test@example.com',
                bio: 'Mock User Bio'
            },
            logout: mockLogout,
        });

        render(<Sidebar />);

        expect(screen.getByText('Creative Director')).toBeInTheDocument();
        expect(screen.getByText('Mock User Bio')).toBeInTheDocument();
        expect(screen.getByText('System Active')).toBeInTheDocument();
        expect(screen.getByTitle('Reload System')).toBeInTheDocument();

        fireEvent.click(screen.getByTitle('Reload System'));
        expect(mockLogout).toHaveBeenCalled();
    });
});
