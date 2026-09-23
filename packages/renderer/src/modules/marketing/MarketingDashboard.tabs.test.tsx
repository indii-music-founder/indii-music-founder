/**
 * MarketingDashboard tab consolidation tests (ISSUE-1442 Stage 2).
 *
 * The marketing domain folds into one destination: the campaign workspace by
 * default, with Brand / Publicist / Social / CRM / Analytics as specialist
 * tabs. The folded module ids stay valid for deep links but are no longer
 * separate nav destinations.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('./components/CampaignDashboard', () => ({
    default: () => <div data-testid="campaign-dashboard-stub">Campaign Dashboard</div>,
}));
vi.mock('./components/BrandManager', () => ({
    default: () => <div data-testid="brand-manager-stub">Brand Manager</div>,
}));
vi.mock('../publicist/PublicistDashboard', () => ({
    default: () => <div data-testid="publicist-dashboard-stub">Publicist Dashboard</div>,
}));
vi.mock('../social/SocialDashboard', () => ({
    default: () => <div data-testid="social-dashboard-stub">Social Dashboard</div>,
}));
vi.mock('../crm/CRMDashboard', () => ({
    default: () => <div data-testid="crm-dashboard-stub">CRM Dashboard</div>,
}));
vi.mock('../analytics/GrowthIntelligenceDashboard', () => ({
    default: () => <div data-testid="analytics-dashboard-stub">Analytics Dashboard</div>,
}));

import MarketingDashboard from './MarketingDashboard';

describe('MarketingDashboard tab consolidation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.history.replaceState(null, '', '/');
    });

    it('defaults to the Departments (campaign) workspace', () => {
        render(<MarketingDashboard />);

        expect(screen.getByRole('tab', { name: /departments/i })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByTestId('campaign-dashboard-stub')).toBeInTheDocument();
    });

    it('offers all five specialist tabs', () => {
        render(<MarketingDashboard />);

        for (const name of [/brand/i, /publicist/i, /social/i, /crm/i, /analytics/i]) {
            expect(screen.getByRole('tab', { name })).toBeInTheDocument();
        }
    });

    it('mounts the folded Brand surface from its tab', async () => {
        render(<MarketingDashboard />);

        fireEvent.click(screen.getByRole('tab', { name: /brand/i }));

        expect(await screen.findByTestId('brand-manager-stub')).toBeInTheDocument();
        expect(screen.queryByTestId('campaign-dashboard-stub')).not.toBeInTheDocument();
    });

    it('mounts the folded Analytics surface from its tab', async () => {
        render(<MarketingDashboard />);

        fireEvent.click(screen.getByRole('tab', { name: /analytics/i }));

        expect(await screen.findByTestId('analytics-dashboard-stub')).toBeInTheDocument();
    });

    it('opens a specialist tab from a ?tab= deep link', async () => {
        window.history.replaceState(null, '', '/marketing?tab=publicist');

        render(<MarketingDashboard />);

        expect(screen.getByRole('tab', { name: /publicist/i })).toHaveAttribute('aria-selected', 'true');
        expect(await screen.findByTestId('publicist-dashboard-stub')).toBeInTheDocument();
    });

    it('switches back to the campaign workspace from a specialist tab', async () => {
        render(<MarketingDashboard />);

        fireEvent.click(screen.getByRole('tab', { name: /social/i }));
        expect(await screen.findByTestId('social-dashboard-stub')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('tab', { name: /departments/i }));
        expect(await screen.findByTestId('campaign-dashboard-stub')).toBeInTheDocument();
    });
});
