
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

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className }: any) => <div className={className}>{children}</div>,
        h1: ({ children, className }: any) => <h1 className={className}>{children}</h1>,
        p: ({ children, className }: any) => <p className={className}>{children}</p>,
        button: ({ children, className }: any) => <button className={className}>{children}</button>,
    },
    useScroll: () => ({ scrollYProgress: { get: () => 0 } }),
    useTransform: () => 0
}));

// Mock lib/auth for getStudioUrl
vi.mock('./lib/auth', () => ({
    getStudioUrl: () => 'https://mock-studio.url'
}));

// Mock Lucide icons
vi.mock('lucide-react', () => ({
    Music: () => <span>Icon</span>,
    Shield: () => <span>Icon</span>,
    Zap: () => <span>Icon</span>,
    Users: () => <span>Icon</span>,
    TrendingUp: () => <span>Icon</span>,
    Sparkles: () => <span>Icon</span>,
    Play: () => <span>Icon</span>,
    ArrowRight: () => <span>Icon</span>,
    Menu: () => <span>Icon</span>,
    X: () => <span>Icon</span>,
}));

// Mock Three.js canvas components to avoid WebGL context issues in JSDOM
vi.mock('@react-three/fiber', () => ({
    Canvas: ({ children }: any) => <div>{children}</div>,
    useFrame: () => { },
    useThree: () => ({ viewport: { width: 100, height: 100 } }),
}));
vi.mock('@react-three/drei', () => ({
    Float: ({ children }: any) => <div>{children}</div>,
    PerspectiveCamera: () => null,
    Environment: () => null,
    ContactShadows: () => null,
}));

describe('The Bouncer 🦍', () => {
    it('shows "Sign In" and "Get Started" when user is NOT logged in', () => {
        (useAuth as any).mockReturnValue({
            user: null,
            loading: false
        });

        render(<LandingPage />);

        // Use getAllByText if duplicates exist (Hero + Nav)
        expect(screen.getAllByText('Sign In').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Get Started').length).toBeGreaterThan(0);

        // Should NOT see Launch Studio
        expect(screen.queryByText('Launch Studio')).not.toBeInTheDocument();
    });

    it('shows "Launch Studio" button when user IS logged in', () => {
        (useAuth as any).mockReturnValue({
            user: { uid: '123', email: 'test@example.com' },
            loading: false
        });

        render(<LandingPage />);

        // Might appear multiple times (Nav + Hero)
        const launchButtons = screen.getAllByText('Launch Studio');
        expect(launchButtons.length).toBeGreaterThan(0);
        expect(launchButtons[0].closest('a')).toHaveAttribute('href', 'https://mock-studio.url');

        expect(screen.queryByText('Sign In')).not.toBeInTheDocument();
    });

    it('shows "Sign In" default when loading (flicker prevention not implemented)', () => {
        (useAuth as any).mockReturnValue({
            user: null,
            loading: true
        });

        render(<LandingPage />);

        expect(screen.getAllByText('Sign In').length).toBeGreaterThan(0);
    });
});
