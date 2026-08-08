import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// ── Mocks ────────────────────────────────────────────────────────

function filterDomProps(props: Record<string, unknown>): Record<string, unknown> {
    const invalidProps = ['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap', 'drag', 'dragSnapToOrigin', 'onDragEnd', 'mode'];
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) {
        if (!invalidProps.includes(key)) {
            filtered[key] = value;
        }
    }
    return filtered;
}

vi.mock('motion/react', () => ({
    motion: {
        div: React.forwardRef(({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLDivElement>) => (
            <div ref={ref} {...filterDomProps(props)}>{children}</div>
        )),
        button: React.forwardRef(({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLButtonElement>) => (
            <button ref={ref} {...filterDomProps(props)}>{children}</button>
        )),
    },
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

vi.mock('motion/react', () => ({
    motion: {
        div: React.forwardRef(({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLDivElement>) => (
            <div ref={ref} {...filterDomProps(props)}>{children}</div>
        )),
    },
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

let mockStoreState: Record<string, unknown> = {};

vi.mock('@/core/store', () => ({
    useStore: (selector: (state: Record<string, unknown>) => unknown) => selector(mockStoreState),
}));

vi.mock('zustand/react/shallow', () => ({
    useShallow: (fn: unknown) => fn,
}));

vi.mock('@/services/StorageService', () => ({
    StorageService: { uploadFile: vi.fn() },
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
        loading: vi.fn(() => 'toast-id'),
        dismiss: vi.fn(),
    }),
}));

vi.mock('@/hooks/useMobile', () => ({
    useMobile: () => ({ isAnyPhone: true }),
}));

vi.mock('@/core/context/VoiceContext', () => ({
    useVoice: () => ({
        isListening: false,
        toggleListening: vi.fn(),
        transcript: '',
    }),
}));

vi.mock('@/services/contacts/FieldContactService', () => ({
    FieldContactService: {
        getCurrentLocation: vi.fn(() => Promise.resolve(null)),
        buildContextString: vi.fn(() => 'Test Location'),
        addFieldContact: vi.fn(),
    },
}));

vi.mock('@/types/contacts', () => ({}));

vi.mock('@/utils/logger', () => ({
    logger: { error: vi.fn(), warn: vi.fn() },
}));

// ── Imports Under Test ───────────────────────────────────────────

import GhostCapture from './GhostCapture';
import { CaptureButtons } from './components/CaptureButtons';
import { CapturePreview } from './components/CapturePreview';

// ── Tests ────────────────────────────────────────────────────────

describe('GhostCapture', () => {
    beforeEach(() => {
        mockStoreState = {
            currentProjectId: 'proj-1',
            userProfile: { id: 'user-1', uid: 'user-1' },
            createFileNode: vi.fn(),
            setModule: vi.fn(),
        };
    });

    it('renders the header with title', () => {
        render(<GhostCapture />);
        expect(screen.getByText('Rapid Capture')).toBeInTheDocument();
        expect(screen.getByText('Quick Asset Setup')).toBeInTheDocument();
    });

    it('shows capture buttons in pre-capture state', () => {
        render(<GhostCapture />);
        expect(screen.getByText('Snap Photo')).toBeInTheDocument();
        expect(screen.getByText('Upload File')).toBeInTheDocument();
    });
});

describe('CaptureButtons', () => {
    it('renders both action buttons', () => {
        const onCapture = vi.fn();
        render(<CaptureButtons onCapture={onCapture} />);
        expect(screen.getByText('Snap Photo')).toBeInTheDocument();
        expect(screen.getByText('Upload File')).toBeInTheDocument();
    });
});

describe('CapturePreview', () => {
    it('renders the captured image and honest upload action without analysis claims', () => {
        render(
            <CapturePreview
                imagePreview="data:image/png;base64,test"
                onTransmit={vi.fn()}
            />
        );
        const img = screen.getByAltText('Captured Document');
        expect(img).toBeInTheDocument();
        expect(screen.getByText(/Upload to Studio/)).toBeInTheDocument();
        expect(screen.queryByText(/analyzing|OCR|scan/i)).not.toBeInTheDocument();
    });
});
