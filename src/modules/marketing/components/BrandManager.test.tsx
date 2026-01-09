import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BrandManager from './BrandManager';

// Mock Toast
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warning: vi.fn(),
    }),
}));

// Mock Store
vi.mock('@/core/store', () => ({
    useStore: () => ({
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
vi.mock('@/services/ai/AIService', () => ({
    AI: {
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
    functions: {},
    db: {}
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn(),
    updateDoc: vi.fn()
}));

// Mock Framer Motion to avoid animation issues in tests
vi.mock('framer-motion', async (importOriginal) => {
    const actual = await importOriginal<typeof import('framer-motion')>();
    return {
        ...actual,
        AnimatePresence: ({ children }: any) => <>{children}</>,
        motion: {
            div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
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
        expect(screen.getByText('Identity Core')).toBeInTheDocument();
        expect(screen.getByText('Visual DNA')).toBeInTheDocument();
        expect(screen.getByText('Current Mission')).toBeInTheDocument();
        expect(screen.getByText('Brand Health')).toBeInTheDocument();
    });

    it('displays identity information by default', () => {
        render(<BrandManager />);
        expect(screen.getByText('Test Bio')).toBeInTheDocument();
        expect(screen.getByText('Artist Bio')).toBeInTheDocument();
    });

    it('switches tabs correctly', async () => {
        render(<BrandManager />);

        // Switch to Visuals
        fireEvent.click(screen.getByText('Visual DNA'));
        await waitFor(() => {
            expect(screen.getByText('Color Palette')).toBeInTheDocument();
        });

        // Switch to Release
        fireEvent.click(screen.getByText('Current Mission'));
        await waitFor(() => {
            expect(screen.getByText('Active Mission')).toBeInTheDocument();
        });
    });

    it('runs analysis in Health Check tab', async () => {
        render(<BrandManager />);

        // Navigate to Health tab
        fireEvent.click(screen.getByText('Brand Health'));

        await waitFor(() => {
            expect(screen.getByText('Content Inspector')).toBeInTheDocument();
        });

        const input = screen.getByPlaceholderText(/Paste caption, email, or lyrics here.../);
        fireEvent.change(input, { target: { value: 'Test content for analysis' } });

        const button = screen.getByText('Run Analysis');
        expect(button).not.toBeDisabled();

        fireEvent.click(button);

        expect(screen.getByText('Run Analysis')).toBeDisabled(); // Should be loading

        await waitFor(() => {
            expect(screen.getByText('Consistency Report')).toBeInTheDocument();
            expect(screen.getByText('95%')).toBeInTheDocument();
        });
    });
});
