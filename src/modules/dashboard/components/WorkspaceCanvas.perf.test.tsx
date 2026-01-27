import { render } from '@testing-library/react';
import { WorkspaceCanvas } from './WorkspaceCanvas';
import { vi } from 'vitest';

// Mock dependencies
vi.mock('@/core/store', () => ({
    useStore: vi.fn(() => ({ isAgentOpen: false }))
}));

describe('WorkspaceCanvas Performance', () => {
    let contextMock: any;

    beforeEach(() => {
        // Setup Canvas Mock
        contextMock = {
            fillStyle: '',
            strokeStyle: '',
            lineWidth: 1,
            fillRect: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            stroke: vi.fn(),
            clearRect: vi.fn(),
        };

        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(contextMock as any);

        // Mock dimensions
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 800 });
        Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 600 });
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 });
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('batches stroke calls to reduce rendering overhead', () => {
        // Mock requestAnimationFrame to run only once immediately
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
           // Do not loop
           return 0;
        });

        render(<WorkspaceCanvas />);

        // Expected grid size is 40
        // 800 / 40 = 20 cols
        // 600 / 40 = 15 rows
        // Total cells = 300

        // In unoptimized code, stroke is called for each cell -> ~300 times
        // We assert it is called exactly once (batched)
        expect(contextMock.stroke).toHaveBeenCalledTimes(1);
    });
});
