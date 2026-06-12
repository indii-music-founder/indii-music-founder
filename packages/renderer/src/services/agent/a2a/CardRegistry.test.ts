import { describe, it, expect } from 'vitest';
import { CARD_REGISTRY, getCardForAgent } from './CardRegistry';
import { AgentCardSchema } from './AgentCard.schema';

/**
 * Load-time contract gate for the A2A card registry.
 *
 * Every agents/<name>/agent_card.json is imported with a blind `as AgentCard`
 * cast in CardRegistry.ts, so a malformed card would only surface deep inside
 * A2ARouter at dispatch time. This suite validates every registered card
 * against AgentCardSchema in CI so a bad card fails the build, not a live run.
 */
describe('CARD_REGISTRY', () => {
    const entries = Object.entries(CARD_REGISTRY);

    it('has registered cards', () => {
        expect(entries.length).toBeGreaterThan(0);
    });

    it.each(entries)('card "%s" validates against AgentCardSchema', (_registryKey, card) => {
        const result = AgentCardSchema.safeParse(card);
        if (!result.success) {
            // Surface the precise Zod failure in the test output.
            expect.fail(`Invalid agent card: ${JSON.stringify(result.error.issues, null, 2)}`);
        }
    });

    it.each(entries)('card "%s" has a non-empty agentId and description', (_registryKey, card) => {
        expect(card.agentId.trim().length).toBeGreaterThan(0);
        expect(card.description.trim().length).toBeGreaterThan(0);
    });

    it('every capability has a name and description', () => {
        for (const [key, card] of entries) {
            for (const cap of card.capabilities) {
                expect(cap.name.trim().length, `${key}:${cap.name}`).toBeGreaterThan(0);
                expect(cap.description.trim().length, `${key}:${cap.name}`).toBeGreaterThan(0);
            }
        }
    });

    it('getCardForAgent resolves registered ids and rejects unknown ids', () => {
        expect(getCardForAgent('analytics')?.agentId).toBe('analytics');
        expect(getCardForAgent('nonexistent-agent')).toBeUndefined();
    });
});
