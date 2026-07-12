import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrgStatusCard } from './OrgStatusCard';
import type { OrgAdapter } from '../types';

const MLC_ADAPTER: OrgAdapter = {
    id: 'mlc',
    name: 'The Mechanical Licensing Collective',
    shortName: 'MLC',
    category: 'mechanical',
    fields: [],
    requiresDesktop: true,
    websiteUrl: 'https://www.themlc.com',
    submit: vi.fn(),
};

/**
 * ISSUE-972: desktop browser automation doesn't actually work in any
 * current build. The "manual step required" notice must show for a
 * requiresDesktop adapter regardless of whether window.electronAPI is
 * present — previously it only showed on the web, implying (falsely)
 * that the desktop app makes filing automatic.
 */
describe('OrgStatusCard (ISSUE-972)', () => {
    afterEach(() => {
        delete (window as unknown as Record<string, unknown>).electronAPI;
    });

    it('shows the manual-step notice on the web (no electronAPI)', () => {
        render(
            <OrgStatusCard adapter={MLC_ADAPTER} status="not_started" isSelected={false} onSelect={vi.fn()} />
        );
        expect(screen.getByText(/Manual step required/i)).toBeInTheDocument();
    });

    it('still shows the manual-step notice inside the Electron desktop app', () => {
        (window as unknown as Record<string, unknown>).electronAPI = { agent: {} };
        render(
            <OrgStatusCard adapter={MLC_ADAPTER} status="not_started" isSelected={false} onSelect={vi.fn()} />
        );
        expect(screen.getByText(/Manual step required/i)).toBeInTheDocument();
    });

    it('does not claim automation is available', () => {
        (window as unknown as Record<string, unknown>).electronAPI = { agent: {} };
        render(
            <OrgStatusCard adapter={MLC_ADAPTER} status="not_started" isSelected={false} onSelect={vi.fn()} />
        );
        expect(screen.queryByText(/Manual step required on web/i)).not.toBeInTheDocument();
        expect(screen.getByText(/automated filing isn't available yet/i)).toBeInTheDocument();
    });
});
