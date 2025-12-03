import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MarketingDashboard from './MarketingDashboard';

// Mock Toast
const mockToast = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
};

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => mockToast,
}));

describe('MarketingDashboard', () => {
    it('renders the dashboard title', () => {
        render(<MarketingDashboard />);
        expect(screen.getByText('Marketing Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Plan, execute, and track your campaigns.')).toBeInTheDocument();
    });

    it('renders stats', () => {
        render(<MarketingDashboard />);
        expect(screen.getByText('Total Reach')).toBeInTheDocument();
        expect(screen.getByText('124.5K')).toBeInTheDocument();
        expect(screen.getByText('Engagement Rate')).toBeInTheDocument();
        expect(screen.getByText('4.8%')).toBeInTheDocument();
    });

    it('renders calendar grid', () => {
        render(<MarketingDashboard />);
        expect(screen.getByText('Campaign Calendar')).toBeInTheDocument();
        // Check for days of week
        expect(screen.getByText('Sun')).toBeInTheDocument();
        expect(screen.getByText('Mon')).toBeInTheDocument();

        // Check for campaign items
        expect(screen.getByText('Product Launch Teaser')).toBeInTheDocument();
        expect(screen.getByText('Newsletter Blast')).toBeInTheDocument();
    });

    it('handles create campaign button', () => {
        render(<MarketingDashboard />);
        const createBtn = screen.getByText('Create Campaign');
        fireEvent.click(createBtn);
        expect(mockToast.info).toHaveBeenCalledWith("Create Campaign modal would open here.");
    });
});
