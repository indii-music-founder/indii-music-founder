import { auth } from '@/services/firebase';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Dashboard from './Dashboard';

// Mock dependencies
vi.mock('@/core/store', () => ({
    useStore: vi.fn(() => ({
        setModule: vi.fn(),
        setProject: vi.fn(),
        currentOrganizationId: 'org-1',
        projects: [
            { id: 'p1', name: 'Test Project', type: 'creative', orgId: 'org-1', date: Date.now() }
        ],
        addProject: vi.fn(),
        createNewProject: vi.fn(),
        addKnowledgeDocument: vi.fn(),
    })),
    AppSlice: {},
}));

vi.mock('@/services/firebase', () => ({
    auth: {
        currentUser: { uid: 'user-1', isAnonymous: false },
        signOut: vi.fn(),
    },
}));

// Mock child components
vi.mock('../onboarding/OnboardingModal', () => ({
    OnboardingModal: ({ isOpen, onClose }: any) => (
        isOpen ? <div data-testid="onboarding-modal"><button onClick={onClose}>Close Onboarding</button></div> : null
    ),
}));

vi.mock('./components/OrganizationSelector', () => ({
    OrganizationSelector: () => <div data-testid="org-selector">Organization Selector</div>,
}));

vi.mock('./components/NewProjectModal', () => ({
    default: ({ isOpen, onClose, onCreate }: any) => (
        isOpen ? (
            <div data-testid="new-project-modal">
                <button onClick={onClose}>Close Modal</button>
                <button onClick={() => onCreate('New Project', 'creative')}>Create Project</button>
            </div>
        ) : null
    ),
}));

describe('Dashboard', () => {
    it('renders the dashboard header and welcome message', () => {
        render(<Dashboard />);
        expect(screen.getByText(/Welcome back to/i)).toBeInTheDocument();
        expect(screen.getByText('indiiOS')).toBeInTheDocument();
        expect(screen.getByTestId('org-selector')).toBeInTheDocument();
    });

    it('renders the New Project button', () => {
        render(<Dashboard />);
        expect(screen.getByText('New Project')).toBeInTheDocument();
    });

    it('opens the New Project modal when button is clicked', () => {
        render(<Dashboard />);
        const newProjectBtn = screen.getByText('New Project');
        fireEvent.click(newProjectBtn);
        expect(screen.getByTestId('new-project-modal')).toBeInTheDocument();
    });

    it('renders recent projects', () => {
        render(<Dashboard />);
        expect(screen.getByText('Recent Projects')).toBeInTheDocument();
        expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    it('renders Knowledge Base upload section', () => {
        render(<Dashboard />);
        expect(screen.getByText('Knowledge Base')).toBeInTheDocument();
        expect(screen.getByText('Upload Knowledge Assets')).toBeInTheDocument();
        expect(screen.getByText('Scan Document')).toBeInTheDocument();
    });

    it('opens Brand Kit modal when button is clicked', () => {
        render(<Dashboard />);
        const brandKitBtn = screen.getByText('Brand Kit');
        fireEvent.click(brandKitBtn);
        expect(screen.getByTestId('onboarding-modal')).toBeInTheDocument();
    });

    it('calls auth.signOut when Sign Out button is clicked', async () => {
        const { auth } = await import('@/services/firebase');
        render(<Dashboard />);
        const signOutBtn = screen.getByText('Sign Out');
        fireEvent.click(signOutBtn);
        expect(auth.signOut).toHaveBeenCalled();
    });
});
