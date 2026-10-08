import { describe, expect, it } from 'vitest';
import { preserveCompletedResponse } from './preserveCompletedResponse';

// Pure text preservation; no customer, model, or service path is simulated.
describe('completed response preservation', () => {
    it('retains all drafts and seven checklist items when a verdict omits them', () => {
        const completed = ['Caption 1: A paper moon.', 'Caption 2: An orange lake.', 'Caption 3: The night is blue.',
            ...Array.from({ length: 7 }, (_, i) => `Day ${i + 1}: Checklist item ${i + 1}.`)].join('\n');
        const result = preserveCompletedResponse(completed, 'Verdict: rollout approved.');
        expect(result).toEqual({ text: completed, measurementMatchesDisplayedText: false });
        expect(result.text.split('\n')).toHaveLength(10);
    });
    it('permits measurement metadata only for the actual displayed answer', () => {
        expect(preserveCompletedResponse('Completed answer.', 'Completed answer.'))
            .toEqual({ text: 'Completed answer.', measurementMatchesDisplayedText: true });
    });
});
