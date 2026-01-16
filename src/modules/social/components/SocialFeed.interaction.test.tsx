
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SocialFeed from './SocialFeed';
import { useSocial } from '../hooks/useSocial';
import { useStore } from '@/core/store';
import { MarketplaceService } from '@/services/marketplace/MarketplaceService';

// Mock the dependencies
vi.mock('../hooks/useSocial');
vi.mock('@/core/store');
vi.mock('@/services/marketplace/MarketplaceService');

// Mock Lucide icons to avoid rendering issues
vi.mock('lucide-react', () => ({
    Heart: () => <div data-testid="icon-heart" />,
    MessageCircle: () => <div data-testid="icon-message-circle" />,
    Share2: () => <div data-testid="icon-share-2" />,
    MoreHorizontal: () => <div data-testid="icon-more-horizontal" />,
    Image: () => <div data-testid="icon-image" />,
    Send: () => <div data-testid="icon-send" />,
    ShoppingBag: () => <div data-testid="icon-shopping-bag" />,
    Ghost: () => <div data-testid="icon-ghost" />,
}));

// Mock ProductCard
vi.mock('@/modules/marketplace/components/ProductCard', () => ({
    default: () => <div data-testid="product-card" />,
}));

describe('SocialFeed Interaction: Send Button', () => {
    const mockCreatePost = vi.fn();
    const mockSetFilter = vi.fn();

    const mockUser = {
        id: 'user-123',
        accountType: 'artist',
        avatarUrl: 'http://example.com/avatar.jpg',
    };

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Setup default mock return values
        (useStore as any).mockImplementation((selector: any) => selector({
            userProfile: mockUser
        }));

        (useSocial as any).mockReturnValue({
            posts: [],
            isFeedLoading: false,
            filter: 'all',
            setFilter: mockSetFilter,
            actions: {
                createPost: mockCreatePost
            }
        });

        (MarketplaceService.getProductsByArtist as any).mockResolvedValue([]);
    });

    it('lifecycle: Click -> Loading -> Success -> Reset', async () => {
        // 1. Render the component
        render(<SocialFeed userId="user-123" />); // render as owner

        // 2. Identify elements
        const textarea = screen.getByLabelText("What's happening in your studio?");
        const sendButton = screen.getByText((content, element) => {
            return element?.tagName.toLowerCase() === 'button' &&
                   (content.includes('Post') || element.querySelector('[data-testid="icon-send"]') !== null);
        });

        // 3. Verify initial state (Disabled because input is empty)
        expect(sendButton).toBeDisabled();

        // 4. Simulate typing
        fireEvent.change(textarea, { target: { value: 'Hello World' } });

        // Verify enabled state
        expect(sendButton).not.toBeDisabled();

        // 5. Setup mock to delay slightly to verify loading state
        mockCreatePost.mockImplementation(async () => {
            await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
            return true; // success
        });

        // 6. Click the button
        fireEvent.click(sendButton);

        // 7. Verify Loading State
        expect(screen.getByText('Posting...')).toBeInTheDocument();
        expect(sendButton).toBeDisabled();

        // 8. Wait for action to complete
        await waitFor(() => {
            expect(mockCreatePost).toHaveBeenCalledWith('Hello World', [], undefined);
        });

        // 9. Verify Success State (Input cleared, Button reset)
        await waitFor(() => {
            expect(textarea).toHaveValue('');
        });

        // Button should be back to "Post" (not "Posting...") and disabled because input is empty
        expect(screen.queryByText('Posting...')).not.toBeInTheDocument();
        // Since input is cleared, button should be disabled again
        expect(sendButton).toBeDisabled();
    });

    it('lifecycle: Click -> Loading -> Failure -> Preserve Input', async () => {
        // 1. Render
        render(<SocialFeed userId="user-123" />);
        const textarea = screen.getByLabelText("What's happening in your studio?");
        const sendButton = screen.getByText((content, element) => {
             return element?.tagName.toLowerCase() === 'button' &&
                   (content.includes('Post') || element.querySelector('[data-testid="icon-send"]') !== null);
        });

        // 2. Type input
        fireEvent.change(textarea, { target: { value: 'This will fail' } });

        // 3. Mock failure
        mockCreatePost.mockResolvedValue(false); // returns false on failure

        // 4. Click
        fireEvent.click(sendButton);

        // 5. Verify call
        await waitFor(() => {
            expect(mockCreatePost).toHaveBeenCalled();
        });

        // 6. Verify Input is PRESERVED (not cleared)
        expect(textarea).toHaveValue('This will fail');

        // 7. Button should be enabled again
        expect(sendButton).not.toBeDisabled();
        expect(screen.queryByText('Posting...')).not.toBeInTheDocument();
    });
});
