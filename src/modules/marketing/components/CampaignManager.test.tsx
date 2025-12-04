import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CampaignManager from './CampaignManager';
import { CampaignStatus } from '../types';

// Mock dependencies
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    }),
}));

vi.mock('@/services/firebase', () => ({
    functions: {},
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn(() => vi.fn(() => Promise.resolve({ data: { posts: [] } }))),
}));

vi.mock('./EditableCopyModal', () => ({
    default: ({ post, onClose, onSave }: any) => (
        <div data-testid="editable-copy-modal">
            <button onClick={onClose}>Close Modal</button>
            <button onClick={() => onSave(post.id, 'Updated Copy')}>Save Copy</button>
        </div>
    ),
}));

describe('CampaignManager', () => {
    const mockCampaign = {
        id: 'c1',
        title: 'Test Campaign',
        durationDays: 7,
        startDate: '2023-01-01',
        posts: [
            {
                id: 'p1',
                day: 1,
                platform: 'Twitter',
                copy: 'Test Tweet',
                status: CampaignStatus.PENDING,
                imageAsset: { imageUrl: 'test.jpg', title: 'Test Image' }
            }
        ]
    };

    const mockOnUpdate = vi.fn();

    it('renders campaign details', () => {
        render(<CampaignManager campaign={mockCampaign} onUpdate={mockOnUpdate} />);
        expect(screen.getByText('Test Campaign')).toBeInTheDocument();
        expect(screen.getByText(/7-day social media campaign/)).toBeInTheDocument();
    });

    it('renders posts', () => {
        render(<CampaignManager campaign={mockCampaign} onUpdate={mockOnUpdate} />);
        expect(screen.getByText('Test Tweet')).toBeInTheDocument();
        expect(screen.getByText('Day 1')).toBeInTheDocument();
    });

    it('opens edit modal when edit button is clicked', () => {
        render(<CampaignManager campaign={mockCampaign} onUpdate={mockOnUpdate} />);
        const editBtn = screen.getByText('Edit');
        fireEvent.click(editBtn);
        expect(screen.getByTestId('editable-copy-modal')).toBeInTheDocument();
    });

    it('calls onUpdate when copy is saved', () => {
        render(<CampaignManager campaign={mockCampaign} onUpdate={mockOnUpdate} />);
        fireEvent.click(screen.getByText('Edit'));
        fireEvent.click(screen.getByText('Save Copy'));

        expect(mockOnUpdate).toHaveBeenCalledWith(expect.objectContaining({
            posts: expect.arrayContaining([
                expect.objectContaining({
                    id: 'p1',
                    copy: 'Updated Copy'
                })
            ])
        }));
    });

    it('calls executeCampaign when execute button is clicked', async () => {
        render(<CampaignManager campaign={mockCampaign} onUpdate={mockOnUpdate} />);
        const executeBtn = screen.getByText('Execute Campaign');
        fireEvent.click(executeBtn);

        // Since we mocked httpsCallable to return a promise, we can wait for the toast or just check if the button state changed.
        // But the mock resolves immediately.
        // Let's verify httpsCallable was called.
        const { httpsCallable } = await import('firebase/functions');
        expect(httpsCallable).toHaveBeenCalled();
    });
});
