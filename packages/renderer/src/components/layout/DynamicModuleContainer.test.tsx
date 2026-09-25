import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
    DynamicModuleContainer,
    getDeterministicLayout,
    type DynamicComponentKey,
} from './DynamicModuleContainer';

describe('DynamicModuleContainer & Layout Assembler', () => {
    describe('getDeterministicLayout', () => {
        it('prioritizes RoyaltySplitTable when hasPendingSplits is true', () => {
            const layout = getDeterministicLayout({
                hasPendingSplits: true,
                unmatchedRoyaltiesCount: 0,
                activeAdCampaigns: 0,
            });

            expect(layout.orderedModules[0]).toBe('RoyaltySplitTable');
            expect(layout.layoutVariant).toBe('expanded');
        });

        it('prioritizes CampaignMonitor when ad campaigns are active and splits are settled', () => {
            const layout = getDeterministicLayout({
                hasPendingSplits: false,
                unmatchedRoyaltiesCount: 0,
                activeAdCampaigns: 2,
            });

            expect(layout.orderedModules[0]).toBe('CampaignMonitor');
            expect(layout.layoutVariant).toBe('expanded');
        });

        it('defaults to compact layout for settled single release', () => {
            const layout = getDeterministicLayout({
                activeReleaseType: 'single',
                hasPendingSplits: false,
                unmatchedRoyaltiesCount: 0,
                activeAdCampaigns: 0,
            });

            expect(layout.layoutVariant).toBe('compact');
            expect(layout.orderedModules.length).toBeGreaterThan(0);
        });
    });

    describe('DynamicModuleContainer Component', () => {
        it('renders requested registered components in order', () => {
            const modules: DynamicComponentKey[] = ['StemInspector', 'RoyaltySplitTable'];

            render(
                <DynamicModuleContainer
                    moduleKeys={modules}
                    contextData={{ activeReleaseType: 'single', unmatchedRoyaltiesCount: 3 }}
                    layoutVariant="compact"
                />
            );

            expect(screen.getByText('Stem Audio Inspector')).toBeInTheDocument();
            expect(screen.getByText('Royalty Split Sheet Escrow')).toBeInTheDocument();
            expect(screen.getByText('3 Unmatched')).toBeInTheDocument();
        });

        it('renders expanded grid when layoutVariant is expanded', () => {
            const { container } = render(
                <DynamicModuleContainer
                    moduleKeys={['CampaignMonitor']}
                    contextData={{ activeAdCampaigns: 4 }}
                    layoutVariant="expanded"
                />
            );

            const gridContainer = container.querySelector('[data-testid="dynamic-module-container"]');
            expect(gridContainer?.className).toContain('grid');
            expect(screen.getByText('Active Campaign Monitor')).toBeInTheDocument();
        });
    });
});
