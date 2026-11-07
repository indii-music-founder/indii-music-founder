import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    addActiveAgent: vi.fn(),
    soloAgent: vi.fn(),
    setCommandBarInput: vi.fn(),
    judgeBoardroomExecutiveIntent: vi.fn(),
    store: {
        commandBarInput: 'Draft a 50/50 split sheet for our co-writers',
        activeAgents: ['generalist'] as string[],
        referencedAssets: [] as unknown[],
        agentHistory: [] as unknown[],
        addActiveAgent: vi.fn(),
        soloAgent: vi.fn(),
        setCommandBarInput: vi.fn(),
    },
}));

vi.mock('@/core/store', () => ({
    useStore: Object.assign(
        (selector: (state: typeof mocks.store) => unknown) => selector(mocks.store),
        {
            setState: vi.fn((update: Partial<typeof mocks.store>) => {
                Object.assign(mocks.store, update);
            }),
        },
    ),
}));

vi.mock('@/config/typesafeJudgments', () => ({
    deterministicBoardroomExecutiveFallback: () => ({
        mission: 'split_rights',
        confidence: 0.85,
        headline: 'Draft split sheets & clear collaborator rights',
        actionLabel: 'Seat Legal + Finance',
        recommendedAgents: ['legal', 'finance'],
        suggestedPrompt: 'Draft a standard 50/50 co-writer split sheet for my current track and check for sample clearance hurdles.',
    }),
    judgeBoardroomExecutiveIntent: mocks.judgeBoardroomExecutiveIntent,
}));

vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'founder-1' } },
}));

vi.mock('@/services/business-harness', () => ({
    boardroomMetaHarnessService: {
        createDecision: () => ({
            mode: 'meta_governed',
            legalRisk: 'low',
            costImpact: { total: 0 },
        }),
    },
}));

import { BoardroomJourney } from './BoardroomJourney';
import { useStore } from '@/core/store';

describe('BoardroomJourney', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.store.commandBarInput = 'Draft a 50/50 split sheet for our co-writers';
        mocks.store.activeAgents = ['generalist'];
        mocks.store.referencedAssets = [];
        mocks.store.agentHistory = [];
        mocks.store.addActiveAgent = mocks.addActiveAgent;
        mocks.store.soloAgent = mocks.soloAgent;
        mocks.store.setCommandBarInput = mocks.setCommandBarInput;
        mocks.judgeBoardroomExecutiveIntent.mockResolvedValue({
            mission: 'split_rights',
            confidence: 0.92,
            headline: 'Draft split sheets & clear collaborator rights',
            actionLabel: 'Seat Legal + Finance',
            recommendedAgents: ['legal', 'finance'],
            suggestedPrompt: 'Draft a standard 50/50 co-writer split sheet for my current track and check for sample clearance hurdles.',
        });
    });

    it('renders inline for the header row with the Missions toggle, Jev recommendation chip, and Governance pill', () => {
        render(<BoardroomJourney />);
        const journey = screen.getByTestId('boardroom-journey');
        expect(journey.tagName).toBe('DIV');
        expect(journey).toHaveAttribute('role', 'group');
        expect(screen.getByTestId('boardroom-missions-toggle')).toBeInTheDocument();
        expect(screen.getByTestId('boardroom-journey-recommendation')).toHaveTextContent('Seat Legal + Finance');
        expect(screen.getByTestId('boardroom-governance-toggle')).toBeInTheDocument();
    });

    it('offers six executive missions and three room seating presets in the Missions popover', () => {
        render(<BoardroomJourney />);
        fireEvent.click(screen.getByTestId('boardroom-missions-toggle'));

        expect(document.getElementById('boardroom-missions-options')).toBeInTheDocument();
        expect(screen.getByTestId('boardroom-mission-master_audit')).toBeInTheDocument();
        expect(screen.getByTestId('boardroom-mission-split_rights')).toBeInTheDocument();
        expect(screen.getByTestId('boardroom-mission-royalty_waterfall')).toBeInTheDocument();
        expect(screen.getByTestId('boardroom-mission-ddex_catalog')).toBeInTheDocument();
        expect(screen.getByTestId('boardroom-mission-campaign_swarm')).toBeInTheDocument();
        expect(screen.getByTestId('boardroom-mission-creative_sync')).toBeInTheDocument();

        expect(screen.getByTestId('boardroom-preset-convene-all')).toBeInTheDocument();
        expect(screen.getByTestId('boardroom-preset-solo-conductor')).toBeInTheDocument();
        expect(screen.getByTestId('boardroom-preset-reset')).toBeInTheDocument();
    });

    it('seats the recommended agents when clicking the inline Jev recommendation chip', () => {
        render(<BoardroomJourney />);
        fireEvent.click(screen.getByTestId('boardroom-journey-recommendation'));
        expect(mocks.addActiveAgent).toHaveBeenCalledWith('legal');
        expect(mocks.addActiveAgent).toHaveBeenCalledWith('finance');
    });

    it('executes Convene All and Solo Conductor presets from the Missions menu', () => {
        render(<BoardroomJourney />);
        fireEvent.click(screen.getByTestId('boardroom-missions-toggle'));
        fireEvent.click(screen.getByTestId('boardroom-preset-convene-all'));
        expect(useStore.setState).toHaveBeenCalledWith(
            expect.objectContaining({
                activeAgents: expect.arrayContaining(['generalist', 'marketing', 'finance', 'legal']),
            }),
        );

        fireEvent.click(screen.getByTestId('boardroom-missions-toggle'));
        fireEvent.click(screen.getByTestId('boardroom-preset-solo-conductor'));
        expect(mocks.soloAgent).toHaveBeenCalledWith('generalist');
    });

    it('opens the Meta-Harness Governance popover and closes it with Escape', () => {
        render(<BoardroomJourney />);
        const govToggle = screen.getByTestId('boardroom-governance-toggle');
        fireEvent.click(govToggle);
        expect(screen.getByTestId('boardroom-governance-popover')).toBeInTheDocument();
        expect(screen.getByText('Meta-Harness Telemetry')).toBeInTheDocument();

        fireEvent.keyDown(govToggle, { key: 'Escape' });
        expect(screen.queryByTestId('boardroom-governance-popover')).not.toBeInTheDocument();
        expect(govToggle).toHaveFocus();
    });
});
