import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import DaisyChainControls from './DaisyChainControls';

const mockSetVideoInput = vi.fn();

const baseVideoInputs = {
    firstFrame: null,
    lastFrame: null,
    isDaisyChain: false,
    timeOffset: 0,
    ingredients: [],
};

vi.mock('@/core/store', () => ({
    useStore: vi.fn(() => ({
        videoInputs: baseVideoInputs,
        setVideoInput: mockSetVideoInput,
    })),
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: vi.fn(() => ({
        info: vi.fn(),
        success: vi.fn(),
        warning: vi.fn(),
        error: vi.fn(),
    })),
}));

import { useStore } from '@/core/store';

function renderWith(videoInputs: typeof baseVideoInputs) {
    (useStore as import("vitest").Mock).mockReturnValue({
        videoInputs,
        setVideoInput: mockSetVideoInput,
    });
    return render(<DaisyChainControls onOpenFrameModal={vi.fn()} />);
}

describe('DaisyChainControls', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders section label and both frame slots', () => {
        renderWith(baseVideoInputs);
        expect(screen.getByText('Composition')).toBeInTheDocument();
        expect(screen.getByTestId('first-frame-slot')).toBeInTheDocument();
        expect(screen.getByTestId('last-frame-slot')).toBeInTheDocument();
    });

    it('calls onOpenFrameModal("firstFrame") when first slot is clicked', () => {
        const onOpen = vi.fn();
        (useStore as import("vitest").Mock).mockReturnValue({
            videoInputs: baseVideoInputs,
            setVideoInput: mockSetVideoInput,
        });
        render(<DaisyChainControls onOpenFrameModal={onOpen} />);
        fireEvent.click(screen.getByTestId('first-frame-slot'));
        expect(onOpen).toHaveBeenCalledWith('firstFrame');
    });

    it('calls onOpenFrameModal("lastFrame") when last slot is clicked', () => {
        const onOpen = vi.fn();
        (useStore as import("vitest").Mock).mockReturnValue({
            videoInputs: baseVideoInputs,
            setVideoInput: mockSetVideoInput,
        });
        render(<DaisyChainControls onOpenFrameModal={onOpen} />);
        fireEvent.click(screen.getByTestId('last-frame-slot'));
        expect(onOpen).toHaveBeenCalledWith('lastFrame');
    });

    it('shows frame image when firstFrame is set', () => {
        renderWith({
            ...baseVideoInputs,
            firstFrame: { url: 'http://example.com/a.jpg', id: '1' } as any,
        });
        expect(screen.getByAltText('First Frame')).toBeInTheDocument();
    });

    it('shows frame image when lastFrame is set', () => {
        renderWith({
            ...baseVideoInputs,
            lastFrame: { url: 'http://example.com/b.jpg', id: '2' } as any,
        });
        expect(screen.getByAltText('Last Frame')).toBeInTheDocument();
    });

    it('clear button calls setVideoInput with null and stops modal from opening', () => {
        const onOpen = vi.fn();
        (useStore as import("vitest").Mock).mockReturnValue({
            videoInputs: { ...baseVideoInputs, firstFrame: { url: 'http://example.com/a.jpg', id: '1' } as any },
            setVideoInput: mockSetVideoInput,
        });
        render(<DaisyChainControls onOpenFrameModal={onOpen} />);

        // The ×  clear button is inside the slot; click it directly
        const clearBtn = screen.getAllByRole('button').find(
            btn => btn.textContent === '×' && btn.closest('[data-testid="first-frame-slot"]')
        );
        expect(clearBtn).toBeTruthy();
        fireEvent.click(clearBtn!);

        expect(mockSetVideoInput).toHaveBeenCalledWith('firstFrame', null);
        expect(onOpen).not.toHaveBeenCalled();
    });

    it('clicking daisy-chain toggle calls setVideoInput to flip isDaisyChain', () => {
        renderWith(baseVideoInputs);
        fireEvent.click(screen.getByTestId('daisy-chain-toggle'));
        expect(mockSetVideoInput).toHaveBeenCalledWith('isDaisyChain', true);
    });

    it('connector line is purple when daisy chain is active', () => {
        const { container } = renderWith({ ...baseVideoInputs, isDaisyChain: true });
        const connector = container.querySelector('.bg-purple-500');
        expect(connector).toBeInTheDocument();
    });

    it('time offset slider calls setVideoInput with parsed integer', () => {
        renderWith(baseVideoInputs);
        fireEvent.change(screen.getByRole('slider'), { target: { value: '3' } });
        expect(mockSetVideoInput).toHaveBeenCalledWith('timeOffset', 3);
    });

    it('shows signed positive offset label', () => {
        renderWith({ ...baseVideoInputs, timeOffset: 4 });
        expect(screen.getByText('+4s')).toBeInTheDocument();
    });

    it('shows negative offset label', () => {
        renderWith({ ...baseVideoInputs, timeOffset: -2 });
        expect(screen.getByText('-2s')).toBeInTheDocument();
    });

    it('shows neutral offset label at zero', () => {
        renderWith(baseVideoInputs);
        expect(screen.getByText('0s')).toBeInTheDocument();
    });
});
