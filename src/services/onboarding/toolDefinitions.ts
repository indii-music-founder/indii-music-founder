import { getSupportedDistributors } from './distributorRequirements';
import { OnboardingTools } from './types';
import type { FunctionDeclaration } from './types';

/**
 * AI Function Declarations (Tool Definitions) for the Onboarding Conversation.
 * These define the callable tools recognized by the Gemini model during onboarding.
 */

export const updateProfileFunction: FunctionDeclaration = {
    name: OnboardingTools.UpdateProfile,
    description: 'Updates fields in the user profile. Distinguishes between PERMANENT Artist Identity and TRANSIENT Release Details.',
    parameters: {
        type: 'OBJECT',
        description: 'The profile fields to update.',
        properties: {
            // Identity Fields (Permanent)
            bio: { type: 'STRING', description: 'The artist\'s biography — their story, background, what makes them unique (Permanent).' },
            creative_preferences: { type: 'STRING', description: 'The artist\'s creative preferences and style notes (Permanent).' },
            brand_description: { type: 'STRING', description: 'Visual brand description — aesthetic, style, colors, mood (Permanent).' },
            colors: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Brand color palette as hex codes or color names.' },
            fonts: { type: 'STRING', description: 'Brand fonts or typography preferences.' },
            aesthetic_style: { type: 'STRING', description: 'Visual aesthetic style (e.g., "Cyberpunk", "Minimalist", "Retro 80s", "Synthwave").' },
            negative_prompt: { type: 'STRING', description: 'Things to AVOID in AI-generated content (e.g., "no neon colors, no cartoons").' },
            visuals_acknowledged: { type: 'BOOLEAN', description: 'Set to true when user confirms they have no visual assets yet (e.g., "None yet - starting fresh"). This marks visuals as complete so we stop asking.' },
            career_stage: { type: 'STRING', description: 'Career stage: Emerging (just starting), Rising (building momentum), Professional (established), Legend (industry veteran).' },
            goals: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Career goals: Touring, Sync Licensing, Grow Fanbase, Label Deal, Brand Partnerships, etc.' },

            // Social & Business (Permanent)
            social_twitter: { type: 'STRING', description: 'Twitter/X handle (e.g., @artistname).' },
            social_instagram: { type: 'STRING', description: 'Instagram handle (e.g., @artistname).' },
            social_spotify: { type: 'STRING', description: 'Spotify artist profile URL.' },
            social_soundcloud: { type: 'STRING', description: 'SoundCloud profile URL.' },
            social_bandcamp: { type: 'STRING', description: 'Bandcamp profile URL.' },
            social_beatport: { type: 'STRING', description: 'Beatport artist profile URL.' },
            social_website: { type: 'STRING', description: 'Official website URL.' },
            pro_affiliation: { type: 'STRING', description: 'Performing Rights Organization (ASCAP, BMI, SESAC, PRS, etc.).' },
            distributor: { type: 'STRING', description: 'Music Distributor (DistroKid, TuneCore, CD Baby, AWAL, etc.).' },

            // Release Fields (Transient - changes per release)
            release_title: { type: 'STRING', description: 'Title of the current Single, EP, or Album.' },
            release_type: { type: 'STRING', description: 'Type of release: Single, EP, Album, Remix, Mixtape.' },
            release_artists: { type: 'STRING', description: 'Artists on this release — solo name, or "Artist feat. Guest" for features/collabs.' },
            release_genre: { type: 'STRING', description: 'Primary genre of this release (e.g., House, Techno, Hip-Hop, Indie Rock, R&B, Pop).' },
            release_mood: { type: 'STRING', description: 'The emotional energy of this release (e.g., Dark, Euphoric, Melancholic, Energetic, Introspective).' },
            release_themes: { type: 'STRING', description: 'Themes or concepts — what is the song/album ABOUT? (e.g., "late-night heartbreak", "summer freedom").' },
            release_lyrics: { type: 'STRING', description: 'Key lyrics or the full lyrics of the song (useful for marketing copy and visuals).' },
        },
    },
};

export const addImageAssetFunction: FunctionDeclaration = {
    name: OnboardingTools.AddImageAsset,
    description: 'Adds an uploaded image to the user\'s brand assets or reference images.',
    parameters: {
        type: 'OBJECT',
        description: 'Details of the image asset to add.',
        properties: {
            file_name: { type: 'STRING', description: 'The name of the file that was uploaded.' },
            asset_type: { type: 'STRING', enum: ['brand_asset', 'reference_image'], description: 'The high-level storage type.' },
            category: {
                type: 'STRING',
                enum: ['headshot', 'bodyshot', 'clothing', 'environment', 'logo', 'other'],
                description: 'The semantic category of the content.'
            },
            tags: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Keywords describing the asset (e.g. "red jacket", "tour 2024").' },
            subject: { type: 'STRING', description: 'Name of the person/subject in the image, if applicable.' },
            description: { type: 'STRING', description: 'A visual description for the image asset.' },
        },
        required: ['file_name', 'asset_type', 'description', 'category'],
    },
};

export const addTextAssetToKnowledgeBaseFunction: FunctionDeclaration = {
    name: OnboardingTools.AddTextAssetToKnowledgeBase,
    description: 'Adds the content of an uploaded text document to the user\'s knowledge base.',
    parameters: {
        type: 'OBJECT',
        description: 'Details of the text document to add to the knowledge base.',
        properties: {
            file_name: { type: 'STRING', description: 'The name of the file that was uploaded.' },
            title: { type: 'STRING', description: 'A descriptive title for this knowledge document.' },
        },
        required: ['file_name', 'title'],
    },
};

export const generateProfileSectionFunction: FunctionDeclaration = {
    name: OnboardingTools.GenerateProfileSection,
    description: 'Generates content for a specific section of the user\'s profile based on the conversation.',
    parameters: {
        type: 'OBJECT',
        description: 'Details for the content generation request.',
        properties: {
            section_to_generate: { type: 'STRING', enum: ['bio', 'brand_description', 'creative_preferences'], description: 'The profile section to generate content for.' },
            user_input: { type: 'STRING', description: 'A summary of the user\'s request and context to use for generation.' },
        },
        required: ['section_to_generate', 'user_input'],
    },
};

export const finishOnboardingFunction: FunctionDeclaration = {
    name: OnboardingTools.FinishOnboarding,
    description: 'Call this function ONLY when BOTH Artist Identity and Current Release details are sufficient.',
    parameters: {
        type: 'OBJECT',
        description: 'The final confirmation message.',
        properties: {
            confirmation_message: { type: 'STRING', description: 'A final, friendly message to send to the user.' },
        },
        required: ['confirmation_message'],
    },
};

export const askMultipleChoiceFunction: FunctionDeclaration = {
    name: OnboardingTools.AskMultipleChoice,
    description: 'Presents a list of options to the user. CRITICAL: You MUST set question_type and options MUST match that category. Never mix categories (e.g., never show release types when asking about visuals).',
    parameters: {
        type: 'OBJECT',
        description: 'Configuration for the multiple choice UI.',
        properties: {
            question_type: {
                type: 'STRING',
                enum: ['release_type', 'career_stage', 'visuals', 'socials', 'genre', 'goals', 'mood', 'aesthetic_style', 'color_vibe', 'font_style', 'distributor'],
                description: 'The category of question. Options MUST match this category exactly.'
            },
            question: { type: 'STRING', description: 'The question to ask the user (e.g., "What is your main genre?").' },
            options: { type: 'ARRAY', items: { type: 'STRING' }, description: 'The list of options to display. Must match the question_type category.' },
            allow_multiple: { type: 'BOOLEAN', description: 'Whether the user can select multiple options.' },
        },
        required: ['question_type', 'question', 'options'],
    },
};

export const shareInsightFunction: FunctionDeclaration = {
    name: OnboardingTools.ShareInsight,
    description: 'Share a relevant music industry insight, tip, or observation based on what the artist has shared. Use this to add value and show expertise. Examples: "Spotify playlisting is great, but TikTok is driving 80% of discovery now" or "The sync licensing market is booming for indie artists."',
    parameters: {
        type: 'OBJECT',
        description: 'The insight to share with context.',
        properties: {
            insight: { type: 'STRING', description: 'The industry insight or tip to share.' },
            context: { type: 'STRING', description: 'Why this insight is relevant to this artist (e.g., "Since you mentioned you\'re focused on touring...").' },
            action_suggestion: { type: 'STRING', description: 'Optional: A specific action the artist could take based on this insight.' },
        },
        required: ['insight', 'context'],
    },
};

export const suggestCreativeDirectionFunction: FunctionDeclaration = {
    name: OnboardingTools.SuggestCreativeDirection,
    description: 'Offer a creative direction or campaign idea based on what you\'ve learned about the artist. This shows you\'re actively thinking about their strategy, not just collecting data.',
    parameters: {
        type: 'OBJECT',
        description: 'A creative suggestion for the artist.',
        properties: {
            suggestion: { type: 'STRING', description: 'The creative direction or idea (e.g., "Given your dark electronic sound and visual aesthetic, a limited-edition visualizer drop before the single could build serious hype").' },
            rationale: { type: 'STRING', description: 'Why you think this would work for them specifically.' },
            examples: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Optional: Reference artists or campaigns that did something similar successfully.' },
        },
        required: ['suggestion', 'rationale'],
    },
};

export const shareDistributorInfoFunction: FunctionDeclaration = {
    name: OnboardingTools.ShareDistributorInfo,
    description: `When an artist mentions their distributor, use this tool to show them the specific requirements and pro tips for that distributor. This includes cover art specs, audio format requirements, metadata fields, timeline recommendations, and insider tips. Supported distributors: ${getSupportedDistributors().join(', ')}.`,
    parameters: {
        type: 'OBJECT',
        description: 'The distributor to show requirements for.',
        properties: {
            distributor_name: { type: 'STRING', description: 'The name of the distributor (e.g., "DistroKid", "TuneCore", "CD Baby", "AWAL").' },
            highlight_section: { type: 'STRING', description: 'Optional: Which section to emphasize (cover_art, audio, metadata, timeline, pricing, tips). If not specified, shows a summary.' },
        },
        required: ['distributor_name'],
    },
};

/**
 * All function declarations for the onboarding AI model.
 */
export const ALL_ONBOARDING_TOOL_DECLARATIONS: FunctionDeclaration[] = [
    updateProfileFunction,
    addImageAssetFunction,
    addTextAssetToKnowledgeBaseFunction,
    generateProfileSectionFunction,
    finishOnboardingFunction,
    askMultipleChoiceFunction,
    shareInsightFunction,
    suggestCreativeDirectionFunction,
    shareDistributorInfoFunction,
];
