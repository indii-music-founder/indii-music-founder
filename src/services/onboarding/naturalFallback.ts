/**
 * Natural Fallback Response Generator
 *
 * Replaces robotic "I processed that" messages with human, contextual responses.
 * Used when the AI model silently updates the profile and we need conversational feedback.
 */

export type TopicKey = 'bio' | 'brandDescription' | 'socials' | 'visuals' | 'careerStage' | 'goals' | 'title' | 'type' | 'genre' | 'mood' | 'themes' | 'distributor' | 'colorPalette' | 'typography' | 'aestheticStyle';

// Educational context for each topic - helps users understand WHY we need this info
const topicContext: Record<TopicKey, { name: string; why: string; examples: string[] }> = {
    bio: {
        name: 'your story',
        why: "Your bio is the foundation of your press kit — journalists, playlist curators, and booking agents read this first",
        examples: ["Where you started", "What drives your sound", "Your musical journey so far"]
    },
    brandDescription: {
        name: 'your visual identity',
        why: "Consistent visuals are how fans recognize you across platforms — it's your visual signature",
        examples: ["Color palette", "Photography style", "The aesthetic that matches your sound"]
    },
    socials: {
        name: 'your social presence',
        why: "This helps me connect your releases across platforms and track your growth",
        examples: ["Instagram", "Spotify", "Your main hangout online"]
    },
    visuals: {
        name: 'visual assets',
        why: "Photos and logos let me generate on-brand content without guessing",
        examples: ["A headshot or press photo", "Your logo if you have one", "Reference images that inspire you"]
    },
    careerStage: {
        name: 'where you are in your journey',
        why: "This shapes everything from release strategy to marketing spend — a debut single needs different rollout than a third album",
        examples: ["Just starting out", "Building momentum", "Already established"]
    },
    goals: {
        name: 'what you\'re aiming for',
        why: "Clear goals mean I can prioritize what actually moves the needle for YOU, not generic advice",
        examples: ["Touring more", "Getting playlisted", "Building a fanbase", "Sync licensing"]
    },
    title: {
        name: 'your release title',
        why: "The title drives SEO, hashtags, and all the copy I'll write for you",
        examples: ["Single name", "EP title", "Album name"]
    },
    type: {
        name: 'the release format',
        why: "A single rollout is totally different from an album campaign — I need to plan accordingly",
        examples: ["Single", "EP", "Album", "Remix"]
    },
    genre: {
        name: 'the genre',
        why: "Genre determines playlist targets, press outlets, and even posting times — each scene has its own rhythm",
        examples: ["Primary genre", "Subgenre if you're specific", "Or genre-fluid if you blend"]
    },
    mood: {
        name: 'the energy',
        why: "The mood shapes everything from cover art direction to caption tone — high-energy needs different treatment than something introspective",
        examples: ["Dark and moody", "Euphoric and uplifting", "Introspective", "High-energy"]
    },
    themes: {
        name: 'what the music is about',
        why: "Themes give me hooks for storytelling — 'heartbreak anthem' writes different copy than 'summer freedom'",
        examples: ["The concept", "What inspired it", "What you want listeners to feel"]
    },
    distributor: {
        name: 'your distributor',
        why: "Every distributor has different rules for cover art and metadata. Knowing this prevents rejection headaches later.",
        examples: ["Symphonic", "CD Baby", "DistroKid", "TuneCore"]
    },
    colorPalette: {
        name: 'color palette',
        why: "Colors set the emotional tone of your visual brand — from vibrant energy to muted introspection",
        examples: ["Vibrant & Neon", "Muted & Earthy", "Black & White"]
    },
    typography: {
        name: 'typography styles',
        why: "Fonts communicate your personality before a single word is read",
        examples: ["Bold & Geometric", "Elegant Serif", "Clean Sans-Serif"]
    },
    aestheticStyle: {
        name: 'aesthetic style',
        why: "Your aesthetic is the visual language that connects your music to your audience",
        examples: ["Cyberpunk", "Minimalist", "Retro 80s"]
    }
};

// Varied acknowledgment phrases (replaces "I processed that")
const acknowledgments = {
    general: [
        "Got it.",
        "Nice.",
        "Cool.",
        "Okay, that helps.",
        "Noted.",
        "Makes sense.",
        "I'm with you.",
        "That works.",
        "Alright.",
    ],
    excited: [
        "Hell yes.",
        "Now we're talking.",
        "That's what I like to hear.",
        "This is good stuff.",
        "I can work with that.",
        "Damn, okay.",
        "Love it.",
    ],
    thoughtful: [
        "Interesting.",
        "I see where you're going.",
        "That gives me something to work with.",
        "Okay, I'm picking up what you're putting down.",
        "That paints a picture.",
    ]
};

// Transition phrases to the next topic
const transitions = {
    natural: [
        "Now,",
        "So,",
        "Next up:",
        "Let's talk about",
        "What about",
        "Moving on —",
        "Quick one:",
    ],
    curious: [
        "I'm curious about",
        "Tell me about",
        "What's the deal with",
        "Talk to me about",
    ]
};

function randomPick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]!;
}

export function generateNaturalFallback(
    updates: string[],
    nextMissing: TopicKey | null,
    _isReleaseContext?: boolean
): string {
    // If we have updates, acknowledge them naturally (without listing them robotically)
    const ack = updates.length > 0
        ? randomPick([...acknowledgments.general, ...acknowledgments.thoughtful])
        : '';

    // If nothing left to ask, we're good
    if (!nextMissing) {
        return ack ? `${ack} Looking solid so far.` : "We're in good shape. Anything else you want to add?";
    }

    const topic = topicContext[nextMissing];
    if (!topic) {
        // Fallback for unknown topics
        return ack
            ? `${ack} What else should I know?`
            : "What else can you tell me?";
    }

    // Build a natural, educational prompt
    const transition = randomPick([...transitions.natural, ...transitions.curious]);

    // ~30% chance to include the "why" explanation (educational)
    const includeWhy = Math.random() < 0.3;

    // ~20% chance to include examples
    const includeExamples = Math.random() < 0.2 && !includeWhy;

    let response = ack ? `${ack} ` : '';

    if (includeWhy) {
        response += `${transition} ${topic.name}. ${topic.why}. What's yours?`;
    } else if (includeExamples) {
        response += `${transition} ${topic.name} — ${topic.examples.slice(0, 2).join(', ')}, that kind of thing.`;
    } else {
        response += `${transition} ${topic.name}?`;
    }

    return response;
}

// Generates a fallback when the AI returns nothing (edge case)
// These pivot to a question-answer format to get the conversation moving
export function generateEmptyResponseFallback(): string {
    const responses = [
        "Okay let me ask you this — what's the ONE thing you want people to feel when they hear your music?",
        "Alright, different angle — if someone asked your biggest fan to describe your sound, what would they say?",
        "Let me put it another way — are you more the high-energy, get-people-moving type or more introspective and chill?",
        "Here's what would help me — tell me about the last song you released. What was it called, what was the mood?",
        "Let me try this differently — if you had to pick three artists that influenced your sound, who would they be?",
        "Let me come at this from another direction — what's the project you're working on right now?",
        "Okay, let me ask something simpler — are you working on a single, an EP, or a full album?",
    ];
    return randomPick(responses);
}
