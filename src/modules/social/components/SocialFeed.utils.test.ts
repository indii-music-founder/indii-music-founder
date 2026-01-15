import { describe, it, expect, vi } from 'vitest';
import { areFeedItemPropsEqual, FeedItemProps } from './SocialFeed.utils';
import { SocialPost } from '@/services/social/types';

const mockPost: SocialPost = {
    id: 'post-1',
    authorId: 'user-1',
    authorName: 'Test User',
    authorAvatar: 'http://example.com/avatar.jpg',
    content: 'Hello World',
    mediaUrls: ['http://example.com/image.jpg'],
    productId: 'prod-1',
    likes: 10,
    commentsCount: 5,
    timestamp: 1620000000000
};

const mockFormatDate = (ts: number) => new Date(ts).toISOString();

const defaultProps: FeedItemProps = {
    post: mockPost,
    formatDate: mockFormatDate
};

describe('SocialFeed.utils', () => {
    describe('areFeedItemPropsEqual', () => {
        it('returns true when props are identical (referentially)', () => {
            expect(areFeedItemPropsEqual(defaultProps, defaultProps)).toBe(true);
        });

        it('returns true when post object is a new reference but has same content', () => {
            const nextProps = {
                ...defaultProps,
                post: { ...mockPost } // New reference
            };
            expect(areFeedItemPropsEqual(defaultProps, nextProps)).toBe(true);
        });

        it('returns true when post object has same content including deep mediaUrls', () => {
            const nextProps = {
                ...defaultProps,
                post: {
                    ...mockPost,
                    mediaUrls: ['http://example.com/image.jpg'] // New array reference, same content
                }
            };
            expect(areFeedItemPropsEqual(defaultProps, nextProps)).toBe(true);
        });

        it('returns false when post id changes', () => {
            const nextProps = {
                ...defaultProps,
                post: { ...mockPost, id: 'post-2' }
            };
            expect(areFeedItemPropsEqual(defaultProps, nextProps)).toBe(false);
        });

        it('returns false when likes change', () => {
            const nextProps = {
                ...defaultProps,
                post: { ...mockPost, likes: 11 }
            };
            expect(areFeedItemPropsEqual(defaultProps, nextProps)).toBe(false);
        });

        it('returns false when content changes', () => {
            const nextProps = {
                ...defaultProps,
                post: { ...mockPost, content: 'New content' }
            };
            expect(areFeedItemPropsEqual(defaultProps, nextProps)).toBe(false);
        });

        it('returns false when mediaUrls content changes', () => {
            const nextProps = {
                ...defaultProps,
                post: {
                    ...mockPost,
                    mediaUrls: ['http://example.com/other.jpg']
                }
            };
            expect(areFeedItemPropsEqual(defaultProps, nextProps)).toBe(false);
        });

        it('returns false when mediaUrls length changes', () => {
            const nextProps = {
                ...defaultProps,
                post: {
                    ...mockPost,
                    mediaUrls: ['http://example.com/image.jpg', 'http://example.com/image2.jpg']
                }
            };
            expect(areFeedItemPropsEqual(defaultProps, nextProps)).toBe(false);
        });

        it('returns false when formatDate function reference changes', () => {
            const nextProps = {
                ...defaultProps,
                formatDate: (ts: number) => new Date(ts).toString() // New function
            };
            expect(areFeedItemPropsEqual(defaultProps, nextProps)).toBe(false);
        });

        it('handles null/undefined mediaUrls gracefully', () => {
            const propsWithNoMedia = {
                ...defaultProps,
                post: { ...mockPost, mediaUrls: undefined }
            };
            const propsWithEmptyMedia = {
                ...defaultProps,
                post: { ...mockPost, mediaUrls: [] }
            };

            // undefined vs undefined -> true
            expect(areFeedItemPropsEqual(propsWithNoMedia, {
                ...propsWithNoMedia,
                post: { ...mockPost, mediaUrls: undefined }
            })).toBe(true);

             // undefined vs [] -> false (length check fails or explicit check)
             // In my implementation: undefined vs []
             // undefined is falsy. [] is truthy.
             // if (!prevMedia || !nextMedia) return prevMedia === nextMedia;
             // undefined === [] is false. Correct.
            expect(areFeedItemPropsEqual(propsWithNoMedia, propsWithEmptyMedia)).toBe(false);
        });
    });
});
