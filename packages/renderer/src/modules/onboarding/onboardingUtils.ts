import { OPTION_WHITELISTS } from '@/services/onboarding/onboardingService';

/**
 * Client-side option validation - ensures AI-provided options match the question type's whitelist
 */
export const validateOptions = (questionType: string, options: string[]): string[] => {
    const whitelist = OPTION_WHITELISTS[questionType];
    if (!whitelist) return options;

    return options.filter(opt => {
        const optLower = opt.toLowerCase();
        return whitelist.some(w => {
            const wLower = w.toLowerCase();
            return wLower.includes(optLower) || optLower.includes(wLower) || wLower === optLower;
        });
    });
};

/**
 * Semantic insight deduplication - catches paraphrased duplicates
 */
export const isSemanticallySimilar = (a: string, b: string): boolean => {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    const wordsA = normalize(a).split(' ').filter(w => w.length > 2);
    const wordsB = normalize(b).split(' ').filter(w => w.length > 2);

    if (wordsA.length === 0 || wordsB.length === 0) return false;

    const overlap = wordsA.filter(w => wordsB.includes(w)).length;
    const similarity = overlap / Math.max(wordsA.length, wordsB.length);
    return similarity > 0.5;
};

export const OPENING_GREETINGS = [
    "Hey — I'm indii. Think of me as your creative director, campaign strategist, and hype person rolled into one. Whether you are a bedroom producer or a platinum artist, I'm here to make sure the world sees what you've got. So tell me — who are you and what's your sound?",
    "Alright, let's do this. I'm indii — part creative director, part campaign architect, full-time believer in independent artists. Your bedroom demo could become a Billboard hit, and TikTok moments can become careers with the right system. What I need to know first: what makes YOUR sound different?",
    "Hey there. I'm indii, and my job is to help turn your music into a movement. But first, I need to get inside your head a bit. Forget the typical 'describe your genre' questions — tell me what you're really trying to say with your music.",
    "What's up — I'm indii. I've been trained by industry professionals to know that the best campaigns come from knowing the artist, not just the music. So before we talk releases and rollouts, let's talk about you. What's the indii pitch? Who are you?",
];
