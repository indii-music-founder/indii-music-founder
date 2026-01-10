import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
    __esModule: true,
}));

// Mock child components to simplify testing the container logic
vi.mock('./CampaignList', () => ({
    default: ({ campaigns, onSelectCampaign, onCreateNew }: any) => (
        <div data-testid="campaign-list">
            <button onClick={onCreateNew}>Create New</button>
            {campaigns.map((c: any) => (
                <div key={c.id} onClick={() => onSelectCampaign(c)}>
                    {c.title}
                </div>
            ))}
        </div>
    ),
    __esModule: true,
}));

vi.mock('./CampaignDetail', () => ({
    default: ({ campaign, onBack, onExecute, onEditPost }: any) => (
        <div data-testid="campaign-detail">
            <h1>{campaign.title}</h1>
            <button onClick={onBack}>Back</button>
            <button onClick={onExecute}>Execute Campaign</button>
            <button onClick={() => onEditPost(campaign.posts[0])}>Edit Post</button>
        </div>
    ),
    __esModule: true,
}));

describe('CampaignManager', () => {
    const mockCampaign = {
        id: 'c1',
        title: 'Test Campaign',
        durationDays: 7,
        startDate: '2023-01-01',
        assetType: 'campaign' as const,
        status: CampaignStatus.PENDING,
        posts: [
            {
                id: 'p1',
                day: 1,
                platform: 'Twitter' as const,
                copy: 'Test Tweet',
                status: CampaignStatus.PENDING,
                imageAsset: { imageUrl: 'test.jpg', title: 'Test Image', assetType: 'image' as const, caption: 'Test Caption' }
            }
        ]
    };

    const mockOnSelectCampaign = vi.fn();
    const mockOnUpdateCampaign = vi.fn();
    const mockOnCreateNew = vi.fn();

    const defaultProps = {
        campaigns: [mockCampaign],
        selectedCampaign: null,
        onSelectCampaign: mockOnSelectCampaign,
        onUpdateCampaign: mockOnUpdateCampaign,
        onCreateNew: mockOnCreateNew
    };

    it('renders campaign list when no campaign is selected', () => {
        render(<CampaignManager {...defaultProps} />);
        expect(screen.getByTestId('campaign-list')).toBeInTheDocument();
        expect(screen.getByText('Test Campaign')).toBeInTheDocument();
    });

    it('renders campaign detail when a campaign is selected', () => {
        render(<CampaignManager {...defaultProps} selectedCampaign={mockCampaign} />);
        expect(screen.getByTestId('campaign-detail')).toBeInTheDocument();
        expect(screen.getByText('Test Campaign')).toBeInTheDocument();
    });

    it('calls onSelectCampaign when a campaign is clicked in list', () => {
        render(<CampaignManager {...defaultProps} />);
        fireEvent.click(screen.getByText('Test Campaign'));
        expect(mockOnSelectCampaign).toHaveBeenCalledWith(mockCampaign);
    });

    it('calls onCreateNew when create button is clicked', () => {
        render(<CampaignManager {...defaultProps} />);
        fireEvent.click(screen.getByText('Create New'));
        expect(mockOnCreateNew).toHaveBeenCalled();
    });

    it('calls onSelectCampaign(null) when back button is clicked in detail', () => {
        render(<CampaignManager {...defaultProps} selectedCampaign={mockCampaign} />);
        fireEvent.click(screen.getByText('Back'));
        expect(mockOnSelectCampaign).toHaveBeenCalledWith(null);
    });

    it('opens edit modal when edit post is triggered from detail', () => {
        render(<CampaignManager {...defaultProps} selectedCampaign={mockCampaign} />);
        fireEvent.click(screen.getByText('Edit Post'));
        expect(screen.getByTestId('editable-copy-modal')).toBeInTheDocument();
    });

    it('updates campaign when post copy is saved', () => {
        render(<CampaignManager {...defaultProps} selectedCampaign={mockCampaign} />);
        fireEvent.click(screen.getByText('Edit Post'));
        fireEvent.click(screen.getByText('Save Copy'));

        expect(mockOnUpdateCampaign).toHaveBeenCalledWith(expect.objectContaining({
            posts: expect.arrayContaining([
                expect.objectContaining({
                    id: 'p1',
                    copy: 'Updated Copy'
                })
            ])
        }));
    });

    it('executes campaign when execute button is clicked', async () => {
        render(<CampaignManager {...defaultProps} selectedCampaign={mockCampaign} />);
        fireEvent.click(screen.getByText('Execute Campaign'));

        // Expect optimistic update
        expect(mockOnUpdateCampaign).toHaveBeenCalledWith(expect.objectContaining({
            status: CampaignStatus.EXECUTING
        }));
    });
});
