import { describe, expect, it } from 'vitest';
import { canvasTextCandidateIndex } from './typesafeJudgments';

describe('masked text routing decision bands (structural regression, not live proof)', () => {
    const regions = 'ABCDEFG'.split('').map((letter, index) => {
        const prompt = `Write only the uppercase letter ${letter} in small black Arial lettering centered inside this marked area on the lower white Polaroid border. Keep the background white. Preserve the dog, garden, frame and all other regions exactly.`;
        return { id: `region_${index}`, prompt, letter };
    });

    it('accepts all seven exact letters from the recorded production JEV answer', () => {
        const probabilities = [0.92, 0.94, 0.93, 0.92, 0.93, 0.93, 0.93];
        const confidence = [0.84, 0.88, 0.86, 0.84, 0.86, 0.86, 0.86];
        const selected = regions.map((_, index) => canvasTextCandidateIndex({
            type: 'choice', choice: 'candidate_0', confidence: confidence[index],
            probabilities: { image: 1 - probabilities[index]!, candidate_0: probabilities[index] },
        }, 1));
        expect(selected).toEqual([0, 0, 0, 0, 0, 0, 0]);
    });

    it.each([
        { type: 'choice', choice: 'image', confidence: 0.99, probabilities: { image: 0.99 } },
        { type: 'choice', choice: 'candidate_0', confidence: 0.79, probabilities: { candidate_0: 0.95 } },
        { type: 'choice', choice: 'candidate_0', confidence: 0.99, probabilities: { candidate_0: 0.85 } },
        { type: 'choice', choice: 'candidate_0', confidence: 0.99 },
        { type: 'choice', choice: 'candidate_99', confidence: 0.99, probabilities: { candidate_99: 0.99 } },
        { type: 'choice', choice: 'candidate_0', confidence: 0.99, probabilities: { candidate_0: Number.NaN } },
    ])('preserves image fallback for uncertain, unsupported, or invalid answers: %j', answer => {
        expect(canvasTextCandidateIndex(answer, 1)).toBeUndefined();
    });
});
