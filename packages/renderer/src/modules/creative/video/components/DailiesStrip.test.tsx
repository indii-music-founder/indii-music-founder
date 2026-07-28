import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { mockWorkspaceLayout } = vi.hoisted(() => ({
    mockWorkspaceLayout: { mode: 'focused' as 'wide' | 'standard' | 'focused', width: 720 },
}));

vi.mock('@/components/layout/AdaptiveWorkspaceContext', () => ({
    useOptionalAdaptiveWorkspace: () => mockWorkspaceLayout,
}));

vi.mock('./DailyItem', () => ({
    DailyItem: ({ video }: { video: { id: string } }) => <div>{video.id}</div>,
}));

import { DailiesStrip } from './DailiesStrip';

describe('DailiesStrip responsive placement', () => {
    it('uses compact prompt-safe placement in a focused workspace', () => {
        render(
            <DailiesStrip
                items={[{
                    id: 'take-1',
                    projectId: 'project-1',
                    type: 'video',
                    url: 'https://example.invalid/take.mp4',
                    prompt: 'Take one',
                    timestamp: 1,
                }]}
                selectedId={null}
                onSelect={vi.fn()}
                onDragStart={vi.fn()}
            />,
        );

        expect(screen.getByTestId('dailies-strip')).toHaveAttribute('data-workspace-mode', 'focused');
        expect(screen.getByTestId('dailies-strip')).toHaveClass('bottom-20', 'left-3', 'right-3', 'h-24');
    });
});
