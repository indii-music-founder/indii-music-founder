import { describe, it, expect } from 'vitest';
import { AgentService } from '../AgentService';

describe('AgentService.isTrivialInput', () => {
    describe('trivial inputs (should return true)', () => {
        const trivialCases = [
            'hi', 'hey', 'hello', 'howdy',
            'Hey there', 'Hi indii',
            'thanks', 'thank you', 'thx', 'ty',
            'ok', 'okay', 'got it', 'sounds good', 'perfect', 'great', 'cool', 'awesome', 'alright',
            'yes', 'yeah', 'yep', 'no', 'nope', 'sure',
            'good morning', 'good afternoon', 'good evening', 'good night',
            'how are you', "how's it going", "what's new",
            'bye', 'goodbye', 'see you later', 'talk soon',
            'go ahead', 'tell me more',
        ];

        trivialCases.forEach(input => {
            it(`classifies "${input}" as trivial`, () => {
                expect(AgentService.isTrivialInput(input)).toBe(true);
            });
        });
    });

    describe('domain inputs (should return false)', () => {
        const domainCases = [
            'Can you help me distribute my new single to Spotify?',
            'I need to register my copyright with the Library of Congress',
            'Generate a marketing plan for my album release',
            'What are the royalty rates for streaming on Apple Music?',
            'Help me draft a split sheet agreement for my producer',
            'I want to create a music video storyboard for my track',
            'How do I register with ASCAP or BMI?',
            'Analyze the BPM and key of my uploaded track',
            'Write press release for my EP dropping next Friday',
            'I have a show in Detroit next month, help me promote it',
        ];

        domainCases.forEach(input => {
            it(`does NOT classify "${input.substring(0, 50)}" as trivial`, () => {
                expect(AgentService.isTrivialInput(input)).toBe(false);
            });
        });
    });
});
