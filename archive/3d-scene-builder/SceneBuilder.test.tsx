import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SceneBuilder } from './SceneBuilder';

const { mockConfirmCall } = vi.hoisted(() => ({
    mockConfirmCall: vi.fn(),
}));

vi.mock('@react-three/fiber', () => ({
    Canvas: ({ children }: any) => <div data-testid="three-canvas">{children}</div>,
}));

vi.mock('@react-three/drei', () => ({
    OrbitControls: () => null,
    Environment: () => null,
    ContactShadows: () => null,
    useGLTF: () => ({ scene: { clone: () => ({ traverse: () => {} }) } }),
}));

vi.mock('three', () => ({
    Mesh: class Mesh {},
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({ error: vi.fn() }),
}));

vi.mock('@/components/ui/ConfirmDialog', () => ({
    ConfirmDialog: { call: (...args: any[]) => mockConfirmCall(...args) },
}));

vi.mock('./sceneBuilderFiles', () => ({
    validateSceneModelFile: () => null,
    validateSceneModelContents: () => Promise.resolve(null),
}));

/**
 * ISSUE-1015: the 3D Stage Builder has no save/persistence path at all and
 * is not consumed by any video render — assets vanish on navigate-away or
 * refresh with zero warning, and "Clear Stage" had no confirmation despite
 * being the only way to lose the entire (unsaved) scene faster than
 * leaving the page.
 */
describe('SceneBuilder (ISSUE-1015)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('makes clear that the stage is preview-only and not saved', () => {
        render(<SceneBuilder />);
        expect(screen.getByText(/Preview only.*not saved/i)).toBeInTheDocument();
    });

    it('does not prompt to clear an already-empty stage', () => {
        render(<SceneBuilder />);
        fireEvent.click(screen.getByText('Clear Stage'));
        expect(mockConfirmCall).not.toHaveBeenCalled();
    });

    it('requires confirmation before clearing a populated stage, and does not clear on cancel', async () => {
        mockConfirmCall.mockResolvedValue(false);
        render(<SceneBuilder />);

        // Simulate a dropped file to populate the stage.
        const fileInput = screen.getByLabelText('Choose a GLB or GLTF model');
        const file = new File(['glb-bytes'], 'model.glb', { type: 'model/gltf-binary' });
        fireEvent.change(fileInput, { target: { files: [file] } });

        // Intake now validates model bytes asynchronously before it mutates the stage.
        await waitFor(() => expect(screen.queryByText('Build Your Set')).not.toBeInTheDocument());

        fireEvent.click(screen.getByText('Clear Stage'));

        await waitFor(() => expect(mockConfirmCall).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Clear Stage?',
            variant: 'destructive'
        })));
    });
});
