import { describe, expect, it } from 'vitest';
import { classifyInstagramMessagingEvent, normalizeInstagramCommerceChange } from './instagramWebhookPolicy';

describe('Instagram webhook policy', () => {
    it('permits only user-initiated message, Story reply, and reaction events', () => {
        expect(classifyInstagramMessagingEvent({ sender: { id: 'fan' }, message: { mid: 'm1', text: 'hello' } }).replyEligible).toBe(true);
        expect(classifyInstagramMessagingEvent({ sender: { id: 'fan' }, message: { mid: 'm2', reply_to: { story: { id: 's1' } } } }).kind).toBe('story_reply');
        expect(classifyInstagramMessagingEvent({ sender: { id: 'fan' }, reaction: { mid: 'm3', action: 'react' } }).replyEligible).toBe(true);
        expect(classifyInstagramMessagingEvent({ sender: { id: 'page' }, message: { mid: 'm4', is_echo: true } })).toMatchObject({ kind: 'ignored_echo', replyEligible: false });
        expect(classifyInstagramMessagingEvent({ follow: { id: 'fan' } })).toMatchObject({ kind: 'ignored_follow', replyEligible: false });
    });

    it('normalizes explicit Shop signals and rejects unrelated changes', () => {
        expect(normalizeInstagramCommerceChange({ field: 'orders', value: { customer_id: 'fan', status: 'paid', order_id: 'o1', amount: 25 } })).toMatchObject({ kind: 'purchase', customerId: 'fan', orderId: 'o1', amount: 25 });
        expect(normalizeInstagramCommerceChange({ field: 'comments', value: { user_id: 'fan' } })).toBeNull();
    });
});
