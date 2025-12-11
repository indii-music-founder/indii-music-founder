import { AI } from '../ai/AIService';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';
import type { UserProfile, ConversationFile, BrandAsset, KnowledgeDocument } from '../../modules/workflow/types';
import { FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';

// --- Types & Enums ---

export enum OnboardingTools {
    UpdateProfile = 'updateProfile',
    AddImageAsset = 'addImageAsset',
    AddTextAssetToKnowledgeBase = 'addTextAssetToKnowledgeBase',
    GenerateProfileSection = 'generateProfileSection',
    FinishOnboarding = 'finishOnboarding',
    AskMultipleChoice = 'askMultipleChoice',
}

export interface UpdateProfileArgs {
    bio?: string;
    preferences?: string;
    brand_description?: string;
    colors?: string[];
    fonts?: string;
    negative_prompt?: string;
    release_title?: string;
    release_type?: string;
    release_mood?: string;
    release_themes?: string;
    social_twitter?: string;
    social_instagram?: string;
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
        type: SchemaType.OBJECT,
        description: 'The profile fields to update.',
        properties: {
            // Identity Fields
            bio: { type: SchemaType.STRING, description: 'The artist\'s biography (Permanent).' },
            preferences: { type: SchemaType.STRING, description: 'The artist\'s creative preferences (Permanent).' },
            brand_description: { type: SchemaType.STRING, description: 'Visual brand description (Permanent).' },
            colors: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: 'Brand color palette.' },
            fonts: { type: SchemaType.STRING, description: 'Brand fonts.' },
            social_twitter: { type: SchemaType.STRING, description: 'Twitter handle.' },
            social_instagram: { type: SchemaType.STRING, description: 'Instagram handle.' },
            career_stage: { type: SchemaType.STRING, description: 'The artist\'s career stage (e.g., Emerging, Professional, Legend).' },
            goals: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: 'Specific career goals (e.g., Tour, Sync, Fanbase).' },

            // Release Fields (Transient)
            release_title: { type: SchemaType.STRING, description: 'Title of the current Single, EP, or Album.' },
            release_type: { type: SchemaType.STRING, description: 'Type of release (Single, EP, Album).' },
            release_mood: { type: SchemaType.STRING, description: 'The specific mood of this release.' },
            release_themes: { type: SchemaType.STRING, description: 'Themes or concepts specific to this release.' },
        },
    },
};

const addImageAssetFunction: FunctionDeclaration = {
    name: OnboardingTools.AddImageAsset,
    description: 'Adds an uploaded image to the user\'s brand assets or reference images.',
    parameters: {
        type: SchemaType.OBJECT,
        description: 'Details of the image asset to add.',
        properties: {
            file_name: { type: SchemaType.STRING, description: 'The name of the file that was uploaded.' },
            asset_type: { type: SchemaType.STRING, format: "enum", enum: ['brand_asset', 'reference_image'], description: 'The high-level storage type.' },
            category: {
                type: SchemaType.STRING,
                format: "enum",
                enum: ['headshot', 'bodyshot', 'clothing', 'environment', 'logo', 'other'],
                description: 'The semantic category of the content.'
            },
            tags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: 'Keywords describing the asset (e.g. "red jacket", "tour 2024").' },
            subject: { type: SchemaType.STRING, description: 'Name of the person/subject in the image, if applicable.' },
            description: { type: SchemaType.STRING, description: 'A visual description for the image asset.' },
        },
        required: ['file_name', 'asset_type', 'description', 'category'],
    },
};

const addTextAssetToKnowledgeBaseFunction: FunctionDeclaration = {
    name: OnboardingTools.AddTextAssetToKnowledgeBase,
    description: 'Adds the content of an uploaded text document to the user\'s knowledge base.',
    parameters: {
        type: SchemaType.OBJECT,
        description: 'Details of the text document to add to the knowledge base.',
        properties: {
            file_name: { type: SchemaType.STRING, description: 'The name of the file that was uploaded.' },
            title: { type: SchemaType.STRING, description: 'A descriptive title for this knowledge document.' },
        },
        required: ['file_name', 'title'],
    },
};

const generateProfileSectionFunction: FunctionDeclaration = {
    name: OnboardingTools.GenerateProfileSection,
    description: 'Generates content for a specific section of the user\'s profile based on the conversation.',
    parameters: {
        type: SchemaType.OBJECT,
        description: 'Details for the content generation request.',
        properties: {
            section_to_generate: { type: SchemaType.STRING, format: "enum", enum: ['bio', 'brand_description', 'preferences'], description: 'The profile section to generate content for.' },
            user_input: { type: SchemaType.STRING, description: 'A summary of the user\'s request and context to use for generation.' },
        },
        required: ['section_to_generate', 'user_input'],
    },
};

const finishOnboardingFunction: FunctionDeclaration = {
    name: OnboardingTools.FinishOnboarding,
    description: 'Call this function ONLY when BOTH Artist Identity and Current Release details are sufficient.',
    parameters: {
        type: SchemaType.OBJECT,
        description: 'The final confirmation message.',
        properties: {
            confirmation_message: { type: SchemaType.STRING, description: 'A final, friendly message to send to the user.' },
        },
        required: ['confirmation_message'],
    },
};

const askMultipleChoiceFunction: FunctionDeclaration = {
    name: OnboardingTools.AskMultipleChoice,
    description: 'Presents a list of options to the user for them to select one or more. Use this for Genres, Career Stages, or quick preferences.',
    parameters: {
        type: SchemaType.OBJECT,
        description: 'Configuration for the multiple choice UI.',
        properties: {
            question: { type: SchemaType.STRING, description: 'The question to ask the user (e.g., "What is your main genre?").' },
            options: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: 'The list of options to display.' },
            allow_multiple: { type: SchemaType.BOOLEAN, description: 'Whether the user can select multiple options.' },
        },
        required: ['question', 'options'],
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

    const baseInstruction = `You are "indii," the Chief Creative Officer and Intake Manager. 
    Your goal is to build a layered profile for the artist.
    
    **LAYER 1: ARTIST IDENTITY** (Progress: ${coreProgress}%)
    Missing: [${coreMissing.join(', ').toUpperCase()}]
    - Who are they? What is their core brand? This rarely changes.
    - **Career Stage**: Where are they in their journey?
    - **Goals**: What are they trying to achieve?

    
    **LAYER 2: CURRENT RELEASE** (Progress: ${releaseProgress}%)
    Missing: [${releaseMissing.join(', ').toUpperCase()}]
    - What are they working on RIGHT NOW? (Single, Album, EP).
    - This is "The Hook". We need to know about *this specific song/project* to market it.
    
    **PROTOCOL:**
    1. **Prioritize Identity**: If Artist Identity is < 100%, focus there first.
    2. **Pivot to Release**: Once Identity is solid, say: "Got it. Now, let's talk about your current project. Is it a single or an album?"
    3. **The "Song"**: If they want to "brag about a song", that goes into **Release Details** (Mood, Themes, Title).
    4. **Silent Updates**: Call \`updateProfile\` immediately when you get new data, but **DO NOT** say "I have updated your profile" or "I've added that to your bio". This breaks the flow.
    5. **Stay in Character**: Instead of confirming the data entry, acknowledge the *content* (e.g., "Techno is a powerful choice." or "Just starting out? That's the most exciting time.").
    6. **Always Follow Up**: After processing their answer, immediately ask the next relevant question to fill the **Missing** fields. Never leave a dead end.
    7. **Tone**: You are "indii," a visionary Creative Director. You are encouraging, sharp, and curious. Treat the user like a star.
    8. **Files**: If the user uploads a file, acknowledge it clearly. Use \`addImageAsset\` or \`addTextAssetToKnowledgeBase\` as needed.
       - **CRITICAL**: When adding images, categorize them correctly (Headshot, Body Shot, Clothing, Logo). Ask who is in the photo or what the clothing item is if not clear.
       - Example: "Is this a photo of you, or the whole band?" -> Tag with Subject.
    9. **Interactive UI**: If you need to ask about **Genre**, **Career Stage**, or **Styles**, DO NOT just ask text. Use \`askMultipleChoice\` to show buttons. It's faster for the user.
       - Example: \`askMultipleChoice("What's your primary genre?", ["House", "Techno", "Hip Hop", "Indie Rock"])\`

    Only call \`finishOnboarding\` when BOTH layers are robust.`;

    // Safety check for update context strings
    const safeBio = userProfile.bio ? userProfile.bio.substring(0, 30) : "";
    const safeTitle = userProfile.brandKit?.releaseDetails?.title || "Untitled";

    const updateInstruction = `You are "indii," helping the user update their profile.
    
    CURRENT CONTEXT:
    Identity: "${safeBio}..."
    Active Release: "${safeTitle}"
    
    **USER INTENT:**
    - If they say "I have a new song/album", treat this as a **Release Context Switch**. Update \`release_title\`, \`release_type\`, etc.
    - If they say "I'm rebranding", update \`bio\`, \`brand_description\`, etc.
    
    ALWAYS preserve the layer they aren't changing.
    `;

    const systemInstruction = mode === 'onboarding' ? baseInstruction : updateInstruction;

    // Prepare contents with files
    const contents = history.map(h => ({ role: h.role, parts: [...h.parts] }));

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
                const hasBrandUpdates = args.brand_description || args.colors || args.fonts || args.negative_prompt || args.social_twitter || args.social_instagram;
                const hasReleaseUpdates = args.release_title || args.release_type || args.release_mood || args.release_themes;

                if (hasBrandUpdates || hasReleaseUpdates) {
                    const newBrandKit = { ...updatedProfile.brandKit };

                    // Identity Updates
                    if (args.brand_description) newBrandKit.brandDescription = args.brand_description;
                    if (args.colors) newBrandKit.colors = args.colors;
                    if (args.fonts) newBrandKit.fonts = args.fonts;
                    if (args.negative_prompt) newBrandKit.negativePrompt = args.negative_prompt;

                    if (args.social_twitter || args.social_instagram) {
                        newBrandKit.socials = {
                            ...newBrandKit.socials,
                            ...(args.social_twitter && { twitter: args.social_twitter }),
                            ...(args.social_instagram && { instagram: args.social_instagram }),
                        };
                        updates.push('Socials');
                    }

                    // Release Updates
                    if (hasReleaseUpdates) {
                        newBrandKit.releaseDetails = {
                            ...newBrandKit.releaseDetails,
                            ...(args.release_title && { title: args.release_title }),
                            ...(args.release_type && { type: args.release_type }),
                            ...(args.release_mood && { mood: args.release_mood }),
                            ...(args.release_themes && { themes: args.release_themes }),
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
