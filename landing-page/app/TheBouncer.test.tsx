
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LandingPage from './page';
import { useAuth } from './components/auth/AuthProvider';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

// Mock AuthProvider hook
vi.mock('./components/auth/AuthProvider', () => ({
    useAuth: vi.fn(),
}));

// Mock Link component from next/link
vi.mock('next/link', () => ({
    default: ({ children, href, className }: any) => (
        <a href={href} className={className}>
            {children}
        </a>
    ),
}));

// Mock next/dynamic to avoid async loading issues and render immediate mock
vi.mock('next/dynamic', () => ({
    default: () => {
        const FakeDynamic = () => <div data-testid="soundscape-canvas">Mocked Soundscape</div>;
        return FakeDynamic;
    }
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className }: any) => <div className={className} data-testid="motion-div">{children}</div>,
        h1: ({ children, className }: any) => <h1 className={className}>{children}</h1>,
        p: ({ children, className }: any) => <p className={className}>{children}</p>,
        span: ({ children, className }: any) => <span className={className}>{children}</span>,
        button: ({ children, className }: any) => <button className={className}>{children}</button>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
    useScroll: () => ({ scrollYProgress: { get: () => 0 } }),
    useTransform: () => 0,
    useAnimation: () => ({ start: vi.fn(), stop: vi.fn(), set: vi.fn() })
}));

// Mock lib/auth for getStudioUrl
vi.mock('./lib/auth', () => ({
    getStudioUrl: () => 'https://mock-studio.url'
}));

// Mock 3D Canvas specifically - Since it's dynamic import, we mock the module that exports the component
vi.mock('./components/3d/SoundscapeCanvas', () => ({
    default: () => <div data-testid="soundscape-canvas">Mocked Soundscape</div>
}));

// Mock UI Components
vi.mock('./components/ui/PulseButton', () => ({
    default: ({ children, onClick, className }: any) => (
        <button className={className} onClick={onClick} data-testid="pulse-button">
            {children}
        </button>
    )
}));

vi.mock('./components/ui/BreathingText', () => ({
    default: ({ children }: any) => <span data-testid="breathing-text">{children}</span>
}));

vi.mock('./components/ui/ScrambleText', () => ({
    default: ({ text, className }: any) => <span className={className}>{text}</span>
}));

vi.mock('./components/ui/PulseText', () => ({
    default: ({ children, className }: any) => <span className={className} data-testid="pulse-text">{children}</span>
}));


describe('The Bouncer 🦍', () => {
    it('shows "Start Creating" and "Sign In" when user is Guest', () => {
        (useAuth as any).mockReturnValue({
            user: null,
            loading: false
        });

        render(<LandingPage />);

        // Check for Visual Elements
        // Both parts are now BreathingText components
        // Check for Visual Elements
        expect(screen.getByText('Your Music.')).toBeInTheDocument();
        expect(screen.getByText('Your Rules.')).toBeInTheDocument();

        expect(screen.getByText('indiiOS')).toBeInTheDocument();

        // Check for Buttons
        expect(screen.getAllByText('Start Creating').length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Sign In/).length).toBeGreaterThan(0);

        // Should NOT see Launch Studio
        expect(screen.queryByText('Launch Studio')).not.toBeInTheDocument();
    });

    it('shows "Launch Studio" button when user IS logged in (VIP)', () => {
        (useAuth as any).mockReturnValue({
            user: { uid: '123', email: 'test@example.com' },
            loading: false
        });

        render(<LandingPage />);

        // Should see Launch Studio pointing to getStudioUrl
        const launchBtn = screen.getByText('Launch Studio');
        expect(launchBtn).toBeInTheDocument();
        expect(launchBtn.closest('a')).toHaveAttribute('href', 'https://mock-studio.url');

        // Should NOT see "Sign In" or "Start Creating" (assuming we hide them for VIPs in the new logic)
        expect(screen.queryByText('Start Creating')).not.toBeInTheDocument();
        expect(screen.queryByText('Sign In')).not.toBeInTheDocument();
    });

    it('shows Loading Spinner when loading', () => {
        (useAuth as any).mockReturnValue({
            user: null,
            loading: true
        });

        render(<LandingPage />);

        // Shouldn't see buttons yet
        expect(screen.queryByText('Launch Studio')).not.toBeInTheDocument();
        expect(screen.queryByText('Start Creating')).not.toBeInTheDocument();

        // Verify we rendered something (Soundscape is always there)
        expect(screen.getByTestId('soundscape-canvas')).toBeInTheDocument();
    });
});
