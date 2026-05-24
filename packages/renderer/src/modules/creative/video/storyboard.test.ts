import { describe, it, expect } from 'vitest';
import { StoryboardSlotSchema, StoryboardProjectSchema } from './schemas/storyboard';

describe('Storyboard Schemas & Quantization Math', () => {
    describe('Storyboard Zod Schemas', () => {
        it('should validate complete StoryboardSlotSchema', () => {
            const validSlot = {
                id: 'slot-1',
                barIndex: 0,
                startBar: 0,
                durationBars: 4,
                prompt: 'Silhouette of a driver at sunset',
                useVocalSync: true,
                useDaisyChain: true
            };
            expect(StoryboardSlotSchema.parse(validSlot).id).toBe('slot-1');
        });

        it('should throw validation error for invalid duration', () => {
            const invalidSlot = {
                id: 'slot-2',
                barIndex: 1,
                startBar: 4,
                durationBars: -1, // Duration must be positive
                prompt: 'Invalid'
            };
            expect(() => StoryboardSlotSchema.parse(invalidSlot)).toThrow();
        });

        it('should validate full StoryboardProjectSchema', () => {
            const validProject = {
                id: 'proj-1',
                name: 'Neon Horizon',
                bpm: 124,
                durationSeconds: 180,
                slots: [
                    {
                        id: 'slot-1',
                        barIndex: 0,
                        startBar: 0,
                        durationBars: 4,
                        prompt: 'Cyberpunk street view'
                    }
                ]
            };
            expect(StoryboardProjectSchema.parse(validProject).name).toBe('Neon Horizon');
        });
    });

    describe('Beat Quantization Calculations', () => {
        it('should correctly calculate bar duration at 120 BPM', () => {
            const bpm = 120;
            // 4 beats per bar
            const barDuration = 4 * (60 / bpm); // 2 seconds
            expect(barDuration).toBe(2);

            const slotDuration = 4 * barDuration; // 8 seconds per slot
            expect(slotDuration).toBe(8);

            const trackDuration = 120; // 2 minutes
            const numSlots = Math.ceil(trackDuration / slotDuration);
            expect(numSlots).toBe(15);
        });

        it('should correctly calculate bar duration at 80 BPM', () => {
            const bpm = 80;
            const barDuration = 4 * (60 / bpm); // 3 seconds
            expect(barDuration).toBe(3);

            const slotDuration = 4 * barDuration; // 12 seconds per slot
            expect(slotDuration).toBe(12);

            const trackDuration = 120;
            const numSlots = Math.ceil(trackDuration / slotDuration);
            expect(numSlots).toBe(10);
        });

        it('should handle edge tempos like 140 BPM correctly', () => {
            const bpm = 140;
            const barDuration = 4 * (60 / bpm); // ~1.714 seconds
            const slotDuration = 4 * barDuration; // ~6.857 seconds
            const trackDuration = 180; // 3 minutes
            const numSlots = Math.ceil(trackDuration / slotDuration);
            expect(numSlots).toBe(27);
        });
    });
});
