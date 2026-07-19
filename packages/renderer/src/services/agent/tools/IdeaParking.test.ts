import { describe, it, expect } from 'vitest';
import { IdeaParkingService } from './IdeaParking';

describe('IdeaParkingService — v1.5 Consent-based Dial Promotion', () => {
    it('offerIdea returns a parked idea with metadata', () => {
        const idea = IdeaParkingService.offerIdea('Try async/await refactor', 'generalist');
        expect(idea.text).toBe('Try async/await refactor');
        expect(idea.source).toBe('generalist');
        expect(idea.id).toMatch(/^idea-/);
        expect(idea.timestamp).toBeGreaterThan(0);
        expect(idea.accepted).toBeUndefined();
    });

    it('idea acceptance threshold is 5', () => {
        expect(IdeaParkingService.IDEA_ACCEPTANCE_THRESHOLD).toBe(5);
    });

    it('ambition prompt cooldown is 24 hours', () => {
        const oneDayMs = 1000 * 60 * 60 * 24;
        expect(IdeaParkingService.AMBITION_PROMPT_COOLDOWN_MS).toBe(oneDayMs);
    });
});
