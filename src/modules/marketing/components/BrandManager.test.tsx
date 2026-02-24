import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BrandManager from './BrandManager';

// Mock Toast
vi.mock('@/core/context/ToastContext', () => ({
  serverTimestamp: vi.fn(),
    useToast: () => ({
  serverTimestamp: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warning: vi.fn(),
    }),
}));

// Mock Store
vi.mock('@/core/store', () => ({
  serverTimestamp: vi.fn(),
    useStore: () => ({
  serverTimestamp: vi.fn(),
        userProfile: {
            id: 'test-user',
            bio: 'Test Bio',
            brandKit: {
                colors: ['#000000'],
                fonts: 'Inter',
                brandDescription: 'Brand Desc',
                releaseDetails: { title: 'Test Release', type: 'Single', genre: 'Pop', mood: 'Happy', themes: 'Love' }
            }
        },
        updateBrandKit: vi.fn(),
        setUserProfile: vi.fn(),
    }),
}));

// Mock AI Service
vi.mock('@/services/ai/GenAI', () => ({
  serverTimestamp: vi.fn(),
    GenAI: {
        generateStructuredData: vi.fn().mockResolvedValue({
            isConsistent: true,
            score: 95,
            issues: [],
            suggestions: ['Great job!']
        }),
        generateContent: vi.fn()
    }
}));

// Mock Firebase Functions
vi.mock('@/services/firebase', () => ({
  serverTimestamp: vi.fn(),
    functions: {},
    db: {},
    remoteConfig: { defaultConfig: {} },
    auth: { currentUser: { uid: 'test-user' } },
    storage: {}
}));

vi.mock('firebase/firestore', () => ({
  serverTimestamp: vi.fn(),
    doc: vi.fn(),
    updateDoc: vi.fn()
}));

// Mock Framer Motion to avoid animation issues in tests
vi.mock('motion/react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('motion/react')>();
    return {
    serverTimestamp: vi.fn(),
        ...actual,
        AnimatePresence: ({ children }: any) => <>{children}</>,
        motion: {
            div: ({ children, layoutId, initial, animate, exit, transition, ...props }: any) => <div {...props}>{children}</div>,
        }
    };
});

describe('BrandManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the main dashboard structure', () => {
        render(<BrandManager />);
        expect(screen.getByText('Brand HQ')).toBeInTheDocument();
        expect(screen.getAllByText('Identity Core').length).toBeGreaterThan(0);
        expect(screen.getByText('Visual DNA')).toBeInTheDocument();
        expect(screen.getByText('Release Manifest')).toBeInTheDocument();
        expect(screen.getByText('Brand Health')).toBeInTheDocument();
    });

    it('displays identity information by default', () => {
        render(<BrandManager />);
        expect(screen.getByText('Test Bio')).toBeInTheDocument();
        expect(screen.getByText('Identity Bio')).toBeInTheDocument();
    });

    it('switches tabs correctly', async () => {
        render(<BrandManager />);

        // Switch to Visuals
        const visualBtn = screen.getByRole('button', { name: /Visual DNA/i });
        fireEvent.click(visualBtn);
        await waitFor(() => {
            expect(screen.getByText('Color Palette')).toBeInTheDocument();
        });

        // Switch to Release
        const releaseBtn = screen.getByRole('button', { name: /Release Manifest/i });
        fireEvent.click(releaseBtn);
        await waitFor(() => {
            expect(screen.getByText('Mission Architect')).toBeInTheDocument();
        });
    });

    it('runs analysis in Health Check tab', async () => {
        render(<BrandManager />);

        // Navigate to Health tab
        const healthBtn = screen.getByRole('button', { name: /Brand Health/i });
        fireEvent.click(healthBtn);

        await waitFor(() => {
            expect(screen.getByText('System Audit')).toBeInTheDocument();
        });

        const input = screen.getByPlaceholderText(/Paste your .* here for high-fidelity brand alignment check.../);
        fireEvent.change(input, { target: { value: 'Test content for analysis' } });

        const button = screen.getByRole('button', { name: /Audit Brand Health/i });
        expect(button).not.toBeDisabled();

        fireEvent.click(button);

        // Should show Analyzing...
        expect(screen.getByText('Analyzing...')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText('Consistency Report')).toBeInTheDocument();
            expect(screen.getByText('95%')).toBeInTheDocument();
        });
    });
});
