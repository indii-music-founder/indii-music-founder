import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CreativeClipboard from '../CreativeClipboard';

const mockUseStore = vi.fn();
vi.mock('@/core/store', () => ({
    useStore: (...args: any[]) => mockUseStore(...args),
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

describe('CreativeClipboard Responsive Positioning', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders null when clipboard is empty', () => {
        mockUseStore.mockImplementation((selector: any) =>
            selector({
                clipboardItems: [],
                unpinFromClipboard: vi.fn(),
                clearClipboard: vi.fn(),
                sendToModule: vi.fn(),
                isRightPanelOpen: false,
            })
        );
        const { container } = render(<CreativeClipboard />);
        expect(container).toBeEmptyDOMElement();
    });

    it('shifts position leftward when right panel is open to prevent covering dock', () => {
        mockUseStore.mockImplementation((selector: any) =>
            selector({
                clipboardItems: [{ id: '1', url: 'https://example.com/asset.png', type: 'image' }],
                unpinFromClipboard: vi.fn(),
                clearClipboard: vi.fn(),
                sendToModule: vi.fn(),
                isRightPanelOpen: true,
            })
        );
        const { container } = render(<CreativeClipboard />);
        const dockRoot = container.querySelector('.fixed');
        expect(dockRoot).toHaveClass('right-[min(26rem,calc(100%-4rem))]');
    });

    it('positions at default right-6 when right panel is closed', () => {
        mockUseStore.mockImplementation((selector: any) =>
            selector({
                clipboardItems: [{ id: '1', url: 'https://example.com/asset.png', type: 'image' }],
                unpinFromClipboard: vi.fn(),
                clearClipboard: vi.fn(),
                sendToModule: vi.fn(),
                isRightPanelOpen: false,
            })
        );
        const { container } = render(<CreativeClipboard />);
        const dockRoot = container.querySelector('.fixed');
        expect(dockRoot).toHaveClass('right-6');
    });
});
