import type { UserProfile, ConversationFile, BrandAsset, KnowledgeDocument, BrandKit, ReleaseDetails, SocialLinks } from '@/modules/workflow/types';
import type { ContentPart, FunctionCallPart, FunctionDeclaration } from '@/shared/types/ai.dto';

// Re-export imported types used by consumers
export type { UserProfile, ConversationFile, BrandAsset, KnowledgeDocument, BrandKit, ReleaseDetails, SocialLinks };
export type { ContentPart, FunctionCallPart, FunctionDeclaration };

// --- Onboarding Phase State Machine ---

export type OnboardingPhase =
    | 'identity_intro'      // Initial greeting, artist name
    | 'identity_core'       // Genre, career stage, goals
    | 'identity_branding'   // Colors, fonts, aesthetics
    | 'identity_visuals'    // Press photos, logo, assets
    | 'release_intro'       // Transition to release focus
    | 'release_details'     // Title, type, mood
    | 'release_assets'      // Cover art, tracklist
    | 'complete';           // All done

export interface ConversationState {
    phase: OnboardingPhase;
    completedTopics: string[];
    pendingTopics: string[];
}

// --- Tool Enums & Arg Interfaces ---

export enum OnboardingTools {
    UpdateProfile = 'updateProfile',
    AddImageAsset = 'addImageAsset',
    AddTextAssetToKnowledgeBase = 'addTextAssetToKnowledgeBase',
    GenerateProfileSection = 'generateProfileSection',
    FinishOnboarding = 'finishOnboarding',
    AskMultipleChoice = 'askMultipleChoice',
    ShareInsight = 'shareInsight',
    SuggestCreativeDirection = 'suggestCreativeDirection',
    ShareDistributorInfo = 'shareDistributorInfo',
}

export interface UpdateProfileArgs {
    bio?: string;
    creative_preferences?: string;
    brand_description?: string;
    colors?: string[];
    fonts?: string;
    aesthetic_style?: string;
    negative_prompt?: string;
    visuals_acknowledged?: boolean;
    release_title?: string;
    release_type?: string;
    release_artists?: string;
    release_genre?: string;
    release_mood?: string;
    release_themes?: string;
    release_lyrics?: string;
    social_twitter?: string;
    social_instagram?: string;
    social_spotify?: string;
    social_soundcloud?: string;
    social_bandcamp?: string;
    social_beatport?: string;
    social_website?: string;
    pro_affiliation?: string;
    distributor?: string;
    career_stage?: string;
    goals?: string[];
}

export interface AddImageAssetArgs {
    file_name: string;
    asset_type: 'brand_asset' | 'reference_image';
    description: string;
    category: 'headshot' | 'bodyshot' | 'clothing' | 'environment' | 'logo' | 'other';
    tags?: string[];
    subject?: string;
}

export interface AddTextAssetArgs {
    file_name: string;
    title: string;
}

export interface GenerateSectionArgs {
    section_to_generate: 'bio' | 'brand_description' | 'creative_preferences';
    user_input: string;
}

// --- Option Whitelists ---

export const OPTION_WHITELISTS: Record<string, string[]> = {
    release_type: ['Single', 'EP (3-6 tracks)', 'Album (7+ tracks)', 'Remix', 'DJ Mix', 'Mixtape'],
    career_stage: ['Just starting out', 'Building momentum', 'Established', 'Industry veteran'],
    visuals: ['Press photos', 'Logo', 'Reference images', 'Album artwork', 'None yet - starting fresh'],
    socials: ['Instagram', 'TikTok', 'Spotify', 'SoundCloud', 'YouTube', 'None'],
    genre: ['House', 'Techno', 'Hip-Hop', 'R&B', 'Pop', 'Indie', 'Electronic', 'Rock', 'Other'],
    goals: ['Grow fanbase', 'Get playlisted', 'Touring', 'Sync licensing', 'Label deal', 'Brand partnerships'],
    mood: ['Dark & moody', 'Euphoric', 'Introspective', 'High-energy', 'Chill', 'Melancholic'],
    aesthetic_style: ['Retro 80s', 'Synthwave', 'Cyberpunk', 'Minimalist', 'Maximalist', 'Vintage', 'Futuristic', 'Organic/Natural', 'Abstract', 'Cinematic'],
    color_vibe: ['Vibrant & Neon', 'Muted & Earthy', 'Black & White', 'Pastels', 'High Contrast', 'Monochrome', 'Warm tones', 'Cool tones'],
    font_style: ['Bold & Geometric', 'Elegant Serif', 'Clean Sans-Serif', 'Vintage/Retro', 'Handwritten', 'Tech/Mono', 'Display/Decorative'],
    distributor: ['Symphonic', 'CD Baby', 'DistroKid', 'TuneCore'],
};
