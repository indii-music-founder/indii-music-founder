import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SocialFeed from '@/modules/social/components/SocialFeed';
import { useSocial } from '@/modules/social/hooks/useSocial';
import { useStore } from '@/core/store';

vi.mock('@/modules/social/hooks/useSocial');
vi.mock('@/core/store');
vi.mock('@/services/marketplace/MarketplaceService');
vi.mock('@/modules/marketplace/components/ProductCard', () => ({ default: () => null }));
vi.mock('@/modules/creative/components/BrandAssetsDrawer', () => ({ default: () => null }));
vi.mock('@/modules/social/components/UserProfileHeader', () => ({
    default: ({ userId }: { userId?: string }) => <div data-testid="profile-header">{userId}</div>,
}));

const post = {
    id: 'post-1',
    authorId: 'artist-9',
    authorName: 'Nova',
    content: 'New single Friday',
    likes: 0,
    commentsCount: 0,
    timestamp: Date.now(),
};

describe('SocialFeed author profiles', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (useStore as unknown as import('vitest').Mock).mockImplementation((selector: (s: unknown) => unknown) =>
            selector({ userProfile: { id: 'me', accountType: 'artist' } }),
        );
        (useSocial as unknown as import('vitest').Mock).mockReturnValue({
            posts: [post],
            isFeedLoading: false,
            filter: 'all',
            setFilter: vi.fn(),
            actions: { createPost: vi.fn() },
        });
    });

    it("opens the author's profile and feed from a post, then returns to the feed", () => {
        render(<SocialFeed />);
        expect(screen.queryByTestId('profile-header')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Nova' }));

        expect(screen.getByTestId('profile-header')).toHaveTextContent('artist-9');
        expect(useSocial).toHaveBeenLastCalledWith('artist-9');
        expect(screen.queryByPlaceholderText(/./, { exact: false })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Back to feed/ }));

        expect(screen.queryByTestId('profile-header')).not.toBeInTheDocument();
        expect(useSocial).toHaveBeenLastCalledWith(undefined);
    });
});
