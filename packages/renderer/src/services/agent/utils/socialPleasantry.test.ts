import { describe, it, expect } from 'vitest';
import { isSocialPleasantry } from './trivialInput';

describe('isSocialPleasantry (ISSUE-1662)', () => {
    it('matches greetings, thanks and goodbyes', () => {
        for (const text of ['hi team', 'Hello!', 'thanks', 'good morning', 'bye', 'how are you?']) {
            expect(isSocialPleasantry(text)).toBe(true);
        }
    });

    it('leaves contextual replies for the board to answer', () => {
        for (const text of ['tell me more', 'no', 'go ahead', 'ok', 'help', '', 'hi, review my contract']) {
            expect(isSocialPleasantry(text)).toBe(false);
        }
    });
});
