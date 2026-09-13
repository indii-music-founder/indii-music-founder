export type InstagramInboundKind = 'message' | 'story_reply' | 'reaction' | 'ignored_echo' | 'ignored_follow' | 'ignored_unknown';

export interface InstagramInboundClassification {
    kind: InstagramInboundKind;
    replyEligible: boolean;
    senderId?: string;
    recipientId?: string;
    eventId?: string;
    text?: string;
}

export function classifyInstagramMessagingEvent(event: Record<string, unknown>): InstagramInboundClassification {
    const senderId = (event.sender as { id?: unknown } | undefined)?.id;
    const recipientId = (event.recipient as { id?: unknown } | undefined)?.id;
    const message = event.message as { mid?: unknown; text?: unknown; is_echo?: unknown; reply_to?: { story?: unknown } } | undefined;
    const reaction = event.reaction as { mid?: unknown; action?: unknown; emoji?: unknown } | undefined;
    const base = {
        ...(typeof senderId === 'string' ? { senderId } : {}),
        ...(typeof recipientId === 'string' ? { recipientId } : {}),
    };
    if (message?.is_echo === true) return { kind: 'ignored_echo', replyEligible: false, ...base };
    if (message && typeof message.mid === 'string') {
        return {
            kind: message.reply_to?.story ? 'story_reply' : 'message',
            replyEligible: true,
            eventId: message.mid,
            ...(typeof message.text === 'string' ? { text: message.text } : {}),
            ...base,
        };
    }
    if (reaction && typeof reaction.mid === 'string') {
        return { kind: 'reaction', replyEligible: true, eventId: `${reaction.mid}:${String(reaction.action ?? 'react')}`, ...base };
    }
    if ('follow' in event || 'follow_event' in event) return { kind: 'ignored_follow', replyEligible: false, ...base };
    return { kind: 'ignored_unknown', replyEligible: false, ...base };
}

export interface InstagramCommerceSignal {
    kind: 'purchase' | 'intent';
    customerId: string;
    orderId?: string;
    amount?: number;
    currency?: string;
}

export function normalizeInstagramCommerceChange(change: Record<string, unknown>): InstagramCommerceSignal | null {
    const field = String(change.field ?? '').toLowerCase();
    if (!['orders', 'checkout', 'shopping_activity', 'purchase_intent'].includes(field)) return null;
    const value = (change.value ?? {}) as Record<string, unknown>;
    const customerId = value.customer_id ?? value.buyer_id ?? value.user_id;
    if (typeof customerId !== 'string' || customerId.length === 0) return null;
    const eventName = String(value.event ?? value.status ?? field).toLowerCase();
    const kind = /purchase|paid|completed|order/.test(eventName) ? 'purchase' : 'intent';
    return {
        kind,
        customerId,
        ...(typeof value.order_id === 'string' ? { orderId: value.order_id } : {}),
        ...(typeof value.amount === 'number' && Number.isFinite(value.amount) ? { amount: value.amount } : {}),
        ...(typeof value.currency === 'string' ? { currency: value.currency } : {}),
    };
}
