import { AI } from '../ai/AIService';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';
import type { UserProfile, ConversationFile, BrandAsset, KnowledgeDocument } from '../../modules/workflow/types';
import type { FunctionDeclaration } from '@/shared/types/ai.dto';
import { v4 as uuidv4 } from 'uuid';
import { getDistributorRequirements, getDistributorSummaryForAI, getSupportedDistributors } from './distributorRequirements';

// --- Types & Enums ---

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
    preferences?: string;
    brand_description?: string;
    colors?: string[];
    fonts?: string;
    negative_prompt?: string;
    // Release fields
    release_title?: string;
    release_type?: string;
    release_artists?: string; // Collaborators, features
    release_genre?: string;
    release_mood?: string;
    release_themes?: string;
    release_lyrics?: string;
    // Social fields
    social_twitter?: string;
    social_instagram?: string;
    social_spotify?: string;
    social_soundcloud?: string;
    social_bandcamp?: string;
    social_beatport?: string;
    social_website?: string;
    pro_affiliation?: string; // Performing Rights Org
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
    section_to_generate: 'bio' | 'brand_description' | 'preferences';
    user_input: string;
}

// --- Function Declarations ---

const updateProfileFunction: FunctionDeclaration = {
    name: OnboardingTools.UpdateProfile,
    description: 'Updates fields in the user profile. Distinguishes between PERMANENT Artist Identity and TRANSIENT Release Details.',
    parameters: {
        type: 'OBJECT',
        description: 'The profile fields to update.',
        properties: {
            // Identity Fields (Permanent)
            bio: { type: 'STRING', description: 'The artist\'s biography — their story, background, what makes them unique (Permanent).' },
            preferences: { type: 'STRING', description: 'The artist\'s creative preferences and style notes (Permanent).' },
            brand_description: { type: 'STRING', description: 'Visual brand description — aesthetic, style, colors, mood (Permanent).' },
            colors: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Brand color palette as hex codes or color names.' },
            fonts: { type: 'STRING', description: 'Brand fonts or typography preferences.' },
            negative_prompt: { type: 'STRING', description: 'Things to AVOID in AI-generated content (e.g., "no neon colors, no cartoons").' },
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

const addImageAssetFunction: FunctionDeclaration = {
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

const addTextAssetToKnowledgeBaseFunction: FunctionDeclaration = {
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

const generateProfileSectionFunction: FunctionDeclaration = {
    name: OnboardingTools.GenerateProfileSection,
    description: 'Generates content for a specific section of the user\'s profile based on the conversation.',
    parameters: {
        type: 'OBJECT',
        description: 'Details for the content generation request.',
        properties: {
            section_to_generate: { type: 'STRING', enum: ['bio', 'brand_description', 'preferences'], description: 'The profile section to generate content for.' },
            user_input: { type: 'STRING', description: 'A summary of the user\'s request and context to use for generation.' },
        },
        required: ['section_to_generate', 'user_input'],
    },
};

const finishOnboardingFunction: FunctionDeclaration = {
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

const askMultipleChoiceFunction: FunctionDeclaration = {
    name: OnboardingTools.AskMultipleChoice,
    description: 'Presents a list of options to the user for them to select one or more. Use this for Genres, Career Stages, or quick preferences.',
    parameters: {
        type: 'OBJECT',
        description: 'Configuration for the multiple choice UI.',
        properties: {
            question: { type: 'STRING', description: 'The question to ask the user (e.g., "What is your main genre?").' },
            options: { type: 'ARRAY', items: { type: 'STRING' }, description: 'The list of options to display.' },
            allow_multiple: { type: 'BOOLEAN', description: 'Whether the user can select multiple options.' },
        },
        required: ['question', 'options'],
    },
};

const shareInsightFunction: FunctionDeclaration = {
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

const suggestCreativeDirectionFunction: FunctionDeclaration = {
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

const shareDistributorInfoFunction: FunctionDeclaration = {
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

// --- Helpers ---

export function calculateProfileStatus(profile: UserProfile) {
    // Safe access to nested properties
    // FIX: Cast fallback to any to avoid "Property does not exist on type '{}'" errors when profile data is incomplete
    const brandKit = profile.brandKit || ({} as any);
    const releaseDetails = brandKit.releaseDetails || {};
    const socials = brandKit.socials || {};
    const brandAssets = brandKit.brandAssets || [];
    const colors = brandKit.colors || [];

    // Level 1: Artist Identity (Permanent)
    const coreChecks = {
        bio: !!profile.bio && profile.bio.length > 10,
        brandDescription: !!brandKit.brandDescription,
        socials: !!(socials.twitter || socials.instagram || socials.website),
        visuals: (brandAssets.length > 0 || colors.length > 0),
        careerStage: !!profile.careerStage,
        goals: !!(profile.goals && profile.goals.length > 0),
    };

    // Level 2: Release Context (Transient)
    const releaseChecks = {
        title: !!releaseDetails.title,
        type: !!releaseDetails.type,
        genre: !!releaseDetails.genre,
        mood: !!releaseDetails.mood,
        themes: !!releaseDetails.themes,
    };

    const coreMissing = Object.keys(coreChecks).filter(key => !coreChecks[key as keyof typeof coreChecks]);
    const releaseMissing = Object.keys(releaseChecks).filter(key => !releaseChecks[key as keyof typeof releaseChecks]);

    const coreProgress = Math.round((Object.values(coreChecks).filter(Boolean).length / Object.keys(coreChecks).length) * 100);
    const releaseProgress = Math.round((Object.values(releaseChecks).filter(Boolean).length / Object.keys(releaseChecks).length) * 100);

    return { coreChecks, releaseChecks, coreMissing, releaseMissing, coreProgress, releaseProgress };
}

// --- Main Service Logic ---

export async function runOnboardingConversation(
    history: { role: string, parts: any[] }[],
    userProfile: UserProfile,
    mode: 'onboarding' | 'update',
    files: ConversationFile[] = []
): Promise<{ text: string, functionCalls?: any[] }> {

    const { coreMissing, releaseMissing, coreProgress, releaseProgress } = calculateProfileStatus(userProfile);

    const baseInstruction = `You are "indii" — a seasoned music industry creative director with 15+ years working with artists from underground scenes to platinum acts. You've seen it all: the bedroom producers who became headliners, the viral moments that changed careers, the artists who burned out and the ones who built empires.

**YOUR PERSONALITY:**
- You speak like someone who's been backstage, in the studio, and in the boardroom
- Sharp, witty, occasionally irreverent — but never condescending
- You get genuinely excited about good ideas and aren't afraid to show it
- You ask the questions a great A&R or manager would ask
- You reference real industry dynamics, not generic advice
- You have opinions (tastefully expressed) and aren't just a yes-bot
- You curse occasionally when excited (tastefully: "damn," "hell yes")
- You use music industry vernacular naturally: "drop," "rollout," "sync," "DSPs," "EPK," "press kit"

**YOUR INTERVIEW STYLE:**
- **Open with energy**: Not clinical questions. More like meeting an artist at a label showcase.
- **Callback technique**: Reference what they've already told you. "You mentioned techno earlier — is this release staying in that lane or are you experimenting?"
- **Probe the interesting bits**: If they say something compelling, dig in before moving on. "Wait, you opened for Disclosure? How'd that shape your sound?"
- **Industry context**: Explain WHY you're asking. "I'm asking about your visual brand because Spotify Canvas and TikTok are visual-first now."
- **React authentically**:
  - To techno/house: "Berlin energy. I respect that."
  - To indie/folk: "There's always room for authenticity in a world of autotune."
  - To hip-hop: "The culture is everything. Who are your influences?"
  - To emerging artists: "This is the best time to be starting. The gatekeepers are gone."
  - To established artists: "Let's make sure the world sees what you've built."
- **Push gently**: If answers are vague, ask for specifics. "When you say 'chill,' do you mean downtempo electronic or more acoustic lo-fi?"

**CONVERSATION FLOW:**
- You're building TWO layers of understanding:

**LAYER 1: ARTIST IDENTITY** (${coreProgress}% complete)
${coreMissing.length > 0 ? `Still need: ${coreMissing.map(m => m.replace(/([A-Z])/g, ' $1').toLowerCase()).join(', ')}` : '✓ Identity locked in'}
- The permanent DNA: Who they ARE, not just what they're releasing
- Career stage, goals, visual brand, social presence, the origin story

**LAYER 2: CURRENT RELEASE** (${releaseProgress}% complete)
${releaseMissing.length > 0 ? `Still need: ${releaseMissing.map(m => m.replace(/([A-Z])/g, ' $1').toLowerCase()).join(', ')}` : '✓ Release details captured'}
- The project they're promoting NOW — this drives the campaign
- Title, type (single/EP/album), mood, themes, the story of THIS release

**INTERVIEW TECHNIQUES:**
1. **Don't interrogate — converse**: Each question should flow from the last answer
2. **Share micro-insights**: "Genre blending is smart — algorithms actually reward that now"
3. **Use callbacks**: "Earlier you said you're focused on touring — does this release have that live energy?"
4. **Validate artistic choices**: "Going independent instead of signing? That takes guts. It's also the smart move if you've got the hustle."
5. **Read between the lines**: If someone's vague about their career stage, they might be embarrassed — make it comfortable
6. **Name-drop context**: "Billie Eilish started in a bedroom. Where do you create?"

**RULES:**
- Call \`updateProfile\` SILENTLY when you get info — never say "I've updated your profile"
- React to the CONTENT, not the data entry: "Damn, that's a strong hook" not "I've saved your release title"
- Use \`askMultipleChoice\` for genre, career stage, goals — it's faster and feels more interactive
- If they upload an image, actually REACT to it: "This shot has main character energy" or "The lighting here is moody — is that the direction for this release?"
- If they're stuck, don't just wait — offer creative starters: "Tell me 3 artists you'd want to open for, and I'll help draft your bio"
- Accept skips gracefully: "Totally fine, we'll circle back" — then MOVE ON
- Keep responses punchy. You're not writing essays. 2-4 sentences max unless diving deep.
- **DISTRIBUTOR INTEL**: When an artist mentions their distributor (DistroKid, TuneCore, CD Baby, AWAL, Ditto, UnitedMasters, Amuse), IMMEDIATELY use \`shareDistributorInfo\` to show them the requirements and pro tips. This is valuable intel — cover art specs, audio formats, metadata requirements, timeline recommendations. Artists NEED this. Save their distributor to the profile too.
- **FILE UPLOADS**: Naturally invite uploads when relevant. They can attach images (press photos, logos, reference art), documents (bio, press kit, lyrics), and audio files. If they upload music, acknowledge it and let them know: "I'll pull some metadata from this to understand the track better — I don't store your audio anywhere, it stays on your device." React to audio uploads with genuine interest: "Nice, let me take a look at what you're working with."

**NEVER DO:**
- Sound like a form or a chatbot
- Say "Great!" or "Awesome!" at the start of every response
- Ask multiple questions at once
- Repeat questions they've already answered
- Be generic — reference THEIR specific answers

Only call \`finishOnboarding\` when both layers feel solid.`;

    // Safety check for update context strings
    const safeBio = userProfile.bio ? userProfile.bio.substring(0, 50) : "";
    const safeTitle = userProfile.brandKit?.releaseDetails?.title || "";
    const safeCareerStage = userProfile.careerStage || "unknown";

    const updateInstruction = `You are "indii" — the same seasoned creative director, checking back in with an artist you already know.

**CURRENT CONTEXT:**
- Their bio starts: "${safeBio}..."
- Career stage: ${safeCareerStage}
- ${safeTitle ? `Active release: "${safeTitle}"` : "No active release on file"}

**YOUR APPROACH:**
You're not starting from scratch — you know this artist. Act like a manager catching up with a client:
- "Back already? What's new — new music or new direction?"
- "Last time we talked you were working on [X]. How'd that turn out?"

**DETECT INTENT:**
- **"New release"** → They're switching release context. Get title, type, mood, themes for the NEW project.
- **"Rebranding"** or **"new direction"** → Identity layer is changing. Update bio, brand description, visuals.
- **"Just updating socials"** → Quick update. Get it done, don't over-complicate.

**RULES:**
- Don't repeat questions about data you already have
- Reference their existing profile naturally
- Keep the same personality — sharp, music-savvy, not robotic
- Silent updates, authentic reactions

ALWAYS preserve what they're NOT changing.`;

    const systemInstruction = mode === 'onboarding' ? baseInstruction : updateInstruction;

    // Prepare contents with files
    const contents = history.map(h => ({
        role: h.role as 'user' | 'model' | 'system' | 'function',
        parts: [...h.parts]
    }));

    // Attach files to the last message if it's from the user
    if (files.length > 0 && contents.length > 0) {
        const lastMsg = contents[contents.length - 1];
        if (lastMsg.role === 'user') {
            files.forEach(file => {
                if (file.type === 'image' && file.base64) {
                    lastMsg.parts.push({
                        text: `[Attached Image: ${file.file.name}]`
                    });
                    lastMsg.parts.push({
                        inlineData: {
                            mimeType: file.file.type,
                            data: file.base64
                        }
                    });
                } else if (file.type === 'document' && file.content) {
                    lastMsg.parts.push({
                        text: `[Attached Document: ${file.file.name}]\n${file.content}`
                    });
                }
            });
        }
    }

    try {
        const response = await AI.generateContent({
            model: AI_MODELS.TEXT.AGENT,
            contents: contents,
            systemInstruction,
            tools: [{
                functionDeclarations: [
                    updateProfileFunction,
                    addImageAssetFunction,
                    addTextAssetToKnowledgeBaseFunction,
                    generateProfileSectionFunction,
                    finishOnboardingFunction,
                    askMultipleChoiceFunction,
                    shareInsightFunction,
                    suggestCreativeDirectionFunction,
                    shareDistributorInfoFunction,
                ]
            }],
            config: {
                ...AI_CONFIG.THINKING.HIGH,
            },
        });

        const text = response.text() || "";
        const functionCalls = response.functionCalls();

        return {
            text,
            functionCalls,
        };
    } catch (error) {
        console.error("Error in onboarding conversation:", error);
        throw error;
    }
}

export function processFunctionCalls(
    functionCalls: any[],
    currentProfile: UserProfile,
    files: ConversationFile[]
): { updatedProfile: UserProfile, isFinished: boolean, updates: string[] } {
    // Start with a shallow copy
    let updatedProfile = { ...currentProfile };
    let isFinished = false;
    const updates: string[] = [];

    functionCalls.forEach(call => {
        switch (call.name) {
            case OnboardingTools.UpdateProfile: {
                const args = call.args as UpdateProfileArgs;

                // Handle root level (Identity)
                if (args.bio) { updatedProfile = { ...updatedProfile, bio: args.bio }; updates.push('Bio'); }
                if (args.preferences) { updatedProfile = { ...updatedProfile, preferences: args.preferences }; updates.push('Preferences'); }
                if (args.career_stage) { updatedProfile = { ...updatedProfile, careerStage: args.career_stage }; updates.push('Career Stage'); }
                if (args.goals) { updatedProfile = { ...updatedProfile, goals: args.goals }; updates.push('Goals'); }

                // Handle BrandKit (Identity + Release)
                const hasBrandUpdates = args.brand_description || args.colors || args.fonts || args.negative_prompt || args.social_twitter || args.social_instagram || args.social_spotify || args.social_soundcloud || args.social_bandcamp || args.social_beatport || args.social_website || args.pro_affiliation || args.distributor;
                const hasReleaseUpdates = args.release_title || args.release_type || args.release_artists || args.release_genre || args.release_mood || args.release_themes || args.release_lyrics;

                if (hasBrandUpdates || hasReleaseUpdates) {
                    const newBrandKit = { ...updatedProfile.brandKit };

                    // Identity Updates
                    if (args.brand_description) { newBrandKit.brandDescription = args.brand_description; updates.push('Brand Description'); }
                    if (args.colors) { newBrandKit.colors = args.colors; updates.push('Colors'); }
                    if (args.fonts) { newBrandKit.fonts = args.fonts; updates.push('Fonts'); }
                    if (args.negative_prompt) { newBrandKit.negativePrompt = args.negative_prompt; updates.push('Negative Prompt'); }

                    if (args.social_twitter || args.social_instagram || args.social_spotify || args.social_soundcloud || args.social_bandcamp || args.social_beatport || args.social_website || args.pro_affiliation || args.distributor) {
                        newBrandKit.socials = {
                            ...newBrandKit.socials,
                            ...(args.social_twitter && { twitter: args.social_twitter }),
                            ...(args.social_instagram && { instagram: args.social_instagram }),
                            ...(args.social_spotify && { spotify: args.social_spotify }),
                            ...(args.social_soundcloud && { soundcloud: args.social_soundcloud }),
                            ...(args.social_bandcamp && { bandcamp: args.social_bandcamp }),
                            ...(args.social_beatport && { beatport: args.social_beatport }),
                            ...(args.social_website && { website: args.social_website }),
                            ...(args.pro_affiliation && { pro: args.pro_affiliation }),
                            ...(args.distributor && { distributor: args.distributor }),
                        };
                        updates.push('Socials');
                    }

                    // Release Updates
                    if (hasReleaseUpdates) {
                        newBrandKit.releaseDetails = {
                            ...newBrandKit.releaseDetails,
                            ...(args.release_title && { title: args.release_title }),
                            ...(args.release_type && { type: args.release_type }),
                            ...(args.release_artists && { artists: args.release_artists }),
                            ...(args.release_genre && { genre: args.release_genre }),
                            ...(args.release_mood && { mood: args.release_mood }),
                            ...(args.release_themes && { themes: args.release_themes }),
                            ...(args.release_lyrics && { lyrics: args.release_lyrics }),
                        };
                        updates.push('Release Details');
                    }

                    updatedProfile = { ...updatedProfile, brandKit: newBrandKit };
                }
                break;
            }
            case OnboardingTools.AddImageAsset: {
                const args = call.args as AddImageAssetArgs;
                const file = files.find(f => f.file.name === args.file_name);
                if (file && file.base64) {
                    const newAsset: BrandAsset = {
                        url: `data:image/png;base64,${file.base64}`,
                        description: args.description,
                        category: args.category,
                        tags: args.tags,
                        subject: args.subject
                    };
                    const newBrandKit = { ...updatedProfile.brandKit };

                    if (args.asset_type === 'brand_asset') {
                        newBrandKit.brandAssets = [...newBrandKit.brandAssets, newAsset];
                        updates.push('Brand Asset');
                    } else if (args.asset_type === 'reference_image') {
                        newBrandKit.referenceImages = [...newBrandKit.referenceImages, newAsset];
                        updates.push('Reference Image');
                    }
                    updatedProfile = { ...updatedProfile, brandKit: newBrandKit };
                }
                break;
            }
            case OnboardingTools.AddTextAssetToKnowledgeBase: {
                const args = call.args as AddTextAssetArgs;
                const docFile = files.find(f => f.file.name === args.file_name);
                if (docFile && docFile.content) {
                    const newDoc: KnowledgeDocument = {
                        id: uuidv4(),
                        name: args.title,
                        content: docFile.content,
                        indexingStatus: 'pending',
                        type: 'text',
                        createdAt: Date.now()
                    };
                    updatedProfile = { ...updatedProfile, knowledgeBase: [...updatedProfile.knowledgeBase, newDoc] };
                    updates.push('Knowledge Base');
                }
                break;
            }
            case OnboardingTools.FinishOnboarding:
                isFinished = true;
                break;
        }
    });

    return { updatedProfile, isFinished, updates };
}

// --- Natural Fallback Response Generator ---
// These replace robotic "I processed that" messages with human, contextual responses

type TopicKey = 'bio' | 'brandDescription' | 'socials' | 'visuals' | 'careerStage' | 'goals' | 'title' | 'type' | 'genre' | 'mood' | 'themes';

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
    return arr[Math.floor(Math.random() * arr.length)];
}

export function generateNaturalFallback(
    updates: string[],
    nextMissing: TopicKey | null,
    isReleaseContext: boolean = false
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

export async function generateSection(section: 'bio' | 'brand_description' | 'preferences', userInput: string): Promise<string> {
    const systemPrompt = `You are a professional copywriter specializing in the music industry. Write a compelling, concise, and professional piece of content for the specified section. The tone should be authentic and engaging. Do not add any extra conversational text, just return the content.`;

    const response = await AI.generateContent({
        model: AI_MODELS.TEXT.AGENT,
        contents: { role: 'user', parts: [{ text: `User Input: "${userInput}"\n\nWrite the ${section}.` }] },
        systemInstruction: systemPrompt,
        config: {
            ...AI_CONFIG.THINKING.HIGH,
        },
    });
    return response.text().trim() || "";
}
