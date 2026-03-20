/**
 * Onboarding Service — Core Conversation Logic
 *
 * This file contains the main AI conversation loop and function call processor.
 * Types, tool definitions, profile calculation, and natural fallback logic have
 * been extracted to their own modules for maintainability:
 *
 * - types.ts             → Types, enums, interfaces, option whitelists
 * - toolDefinitions.ts   → AI function declarations for the model
 * - profileCalculator.ts → Profile completeness + phase determination
 * - naturalFallback.ts   → Human-like fallback response generation
 */

import { GenAI as AI } from '../ai/GenAI';
import { AI_CONFIG, AI_MODELS } from '@/core/config/ai-models';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/utils/logger';

// Re-export everything from sub-modules for backward compatibility
export type {
    OnboardingPhase,
    ConversationState,
    UpdateProfileArgs,
    AddImageAssetArgs,
    AddTextAssetArgs,
    GenerateSectionArgs,
    UserProfile,
    ConversationFile,
    BrandAsset,
    KnowledgeDocument,
    BrandKit,
    ReleaseDetails,
    SocialLinks,
    ContentPart,
    FunctionCallPart,
    FunctionDeclaration,
} from './types';

export {
    OnboardingTools,
    OPTION_WHITELISTS,
} from './types';

export {
    calculateProfileStatus,
    determinePhase,
} from './profileCalculator';

export {
    generateNaturalFallback,
    generateEmptyResponseFallback,
} from './naturalFallback';
export type { TopicKey } from './naturalFallback';

// Import what we need internally
import { calculateProfileStatus, determinePhase } from './profileCalculator';
import { ALL_ONBOARDING_TOOL_DECLARATIONS } from './toolDefinitions';
import {
    OnboardingTools,
    type OnboardingPhase,
    type UserProfile,
    type ConversationFile,
    type ContentPart,
    type FunctionCallPart,
    type UpdateProfileArgs,
    type AddImageAssetArgs,
    type AddTextAssetArgs,
    type BrandKit,
    type BrandAsset,
    type KnowledgeDocument,
    type ReleaseDetails,
} from './types';


// --- Main Conversation Runner ---

export async function runOnboardingConversation(
    history: { role: string, parts: ContentPart[] }[],
    userProfile: UserProfile,
    mode: 'onboarding' | 'update',
    files: ConversationFile[] = []
): Promise<{ text: string, functionCalls?: FunctionCallPart['functionCall'][] }> {

    const { coreMissing, releaseMissing, coreProgress, releaseProgress } = calculateProfileStatus(userProfile);
    const currentPhase = determinePhase(userProfile);

    // Phase-specific focus instructions
    const phaseInstructions: Record<OnboardingPhase, string> = {
        identity_intro: "CURRENT FOCUS: Get their name and story. Build rapport first.",
        identity_core: "CURRENT FOCUS: Career stage, genre, goals, and DISTRIBUTOR. These shape everything.",
        identity_branding: "CURRENT FOCUS: Visual identity — colors, fonts, aesthetic style. This powers AI image generation.",
        identity_visuals: "CURRENT FOCUS: Visual assets — press photos, logo, references. If they have none, get acknowledgment and move on.",
        release_intro: "CURRENT FOCUS: Transition to the current release. What are they promoting?",
        release_details: "CURRENT FOCUS: Release specifics — title, type, mood, themes.",
        release_assets: "CURRENT FOCUS: Release assets — cover art, tracklist, lyrics.",
        complete: "PROFILE COMPLETE: Both identity and release are solid. Confirm and wrap up.",
    };

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
- Career stage, goals, visual brand, social presence, DISTRIBUTOR, the origin story

**LAYER 2: CURRENT RELEASE** (${releaseProgress}% complete)
${releaseMissing.length > 0 ? `Still need: ${releaseMissing.map(m => m.replace(/([A-Z])/g, ' $1').toLowerCase()).join(', ')}` : '✓ Release details captured'}
- The project they're promoting NOW — this drives the campaign
- Title, type (single/EP/album), mood, themes, the story of THIS release

**${phaseInstructions[currentPhase]}**

**CONVERSATION FLOW (State Machine):**
Phase 1 (Identity): intro → bio → genre → career_stage → goals → distributor → branding (colors, fonts, aesthetic) → visuals
Phase 2 (Release): intro → title → type → mood → themes → assets
NEVER jump phases. Complete each topic before moving on. If a topic is done, skip it.

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

**askMultipleChoice RULES (CRITICAL):**
- ALWAYS set question_type to match your question category
- visuals → options: Press photos, Logo, Reference images, Album artwork, None yet - starting fresh
- release_type → options: Single, EP (3-6 tracks), Album (7+ tracks), Remix, DJ Mix
- career_stage → options: Just starting out, Building momentum, Established, Industry veteran
- genre → options: House, Techno, Hip-Hop, R&B, Pop, Indie, Electronic, Rock, Other
- goals → options: Grow fanbase, Get playlisted, Touring, Sync licensing, Label deal
- mood → options: Dark & moody, Euphoric, Introspective, High-energy, Chill
- aesthetic_style → options: Retro 80s, Synthwave, Cyberpunk, Minimalist, Maximalist, Vintage, Futuristic, Organic/Natural, Abstract, Cinematic
- color_vibe → options: Vibrant & Neon, Muted & Earthy, Black & White, Pastels, High Contrast, Monochrome, Warm tones, Cool tones
- font_style → options: Bold & Geometric, Elegant Serif, Clean Sans-Serif, Vintage/Retro, Handwritten, Tech/Mono, Display/Decorative
- distributor → options: Symphonic, CD Baby, DistroKid, TuneCore
- NEVER show release type options when asking about visuals — this confuses users
- **CRITICAL**: If user says "none", "starting fresh", "no visuals", "don't have any" for visuals, you MUST call \`updateProfile({ visuals_acknowledged: true })\` to mark it complete, then MOVE ON to the next topic. Do NOT ask about visuals again after they've answered.
- If they upload an image, actually REACT to it: "This shot has main character energy" or "The lighting here is moody — is that the direction for this release?"
- If they're stuck, don't just wait — offer creative starters: "Tell me 3 artists you'd want to open for, and I'll help draft your bio"
- Accept skips gracefully: "Totally fine, we'll circle back" — then MOVE ON
- Keep responses punchy. You're not writing essays. 2-4 sentences max unless diving deep.
- **DISTRIBUTOR SELECTION**: This is critical. You MUST ask "Who do you distribute with?" if it's missing (check Identity layer). Use \`askMultipleChoice\` with question_type='distributor'.
- **DISTRIBUTOR INTEL**: When they select a distributor, IMMEDIATELY use \`shareDistributorInfo\` to show them the requirements and pro tips. This is valuable intel — cover art specs, audio formats, metadata requirements, timeline recommendations. Artists NEED this. Save their distributor to the profile too.
- **FILE UPLOADS**: Naturally invite uploads when relevant. They can attach images (press photos, logos, reference art), documents (bio, press kit, lyrics), and audio files. If they upload music, acknowledge it and let them know: "I'll pull some metadata from this to understand the track better — I don't store your audio anywhere, it stays on your device." React to audio uploads with genuine interest: "Nice, let me take a look at what you're working with."

**VISUAL BRANDING (IMPORTANT - Don't skip this!):**
Artists need strong visual identity. Ask about these naturally during the conversation:

1. **Aesthetic Style**: "What visual era or style fits your music? Retro 80s? Cyberpunk? Minimalist?"
   - Use \`askMultipleChoice\` with question_type='aesthetic_style'
   - Store the answer in \`brand_description\` (append to existing)

2. **Colors**: "What are your brand colors? Or describe the color vibe you're going for."
   - Use \`askMultipleChoice\` with question_type='color_vibe' for quick selection
   - OR ask directly: "Give me 2-3 colors (hex codes or names like 'deep purple, gold')"
   - Store in \`colors\` array via \`updateProfile({ colors: ['#8B5CF6', '#F59E0B'] })\`

3. **Typography**: "What typography style fits your brand?"
   - Use \`askMultipleChoice\` with question_type='font_style'
   - Store in \`fonts\` field

4. **What to AVOID (Negative Prompt)**: "Any visual styles you want to avoid? Like 'no cartoons' or 'no neon'?"
   - This is GOLD for AI image generation
   - Store in \`negative_prompt\` field

**Why this matters**: These fields power the AI image generator. Without colors/aesthetic, we can't create on-brand visuals. Make it conversational: "I noticed you said 'dark and moody' — are we talking muted earth tones or high-contrast black and white?"

**AFTER SILENT UPDATES (CRITICAL):**
When you call updateProfile silently (which you should), you MUST still respond with:
- A brief acknowledgment ("Got it!", "Nice.", "I'm with you.")
- A natural transition to the next topic
- OR the next question

NEVER return an empty or near-empty response after updateProfile. The user should always get conversational feedback.

**NEVER DO:**
- Sound like a form or a chatbot
- Say "Great!" or "Awesome!" at the start of every response
- Ask multiple questions at once
- Repeat questions they've already answered
- Be generic — reference THEIR specific answers
- Return empty responses after silent profile updates

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
        const lastMsg = contents[contents.length - 1]!;
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
        const response = await AI.generateContent(
            contents,
            AI_MODELS.TEXT.AGENT,
            {
                systemInstruction,
                tools: [{
                    functionDeclarations: ALL_ONBOARDING_TOOL_DECLARATIONS,
                }],
                ...AI_CONFIG.THINKING.HIGH,
            }
        );

        const text = response.response.text() || "";
        const functionCalls = (response.response.functionCalls?.() as { name: string; args: Record<string, unknown>; }[] | undefined);

        return {
            text,
            functionCalls,
        };
    } catch (error) {
        logger.error("Error in onboarding conversation:", error);
        throw error;
    }
}


// --- Function Call Processor ---

export function processFunctionCalls(
    functionCalls: FunctionCallPart['functionCall'][],
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
                if (args.creative_preferences) { updatedProfile = { ...updatedProfile, creativePreferences: args.creative_preferences }; updates.push('Creative Preferences'); }
                if (args.career_stage) { updatedProfile = { ...updatedProfile, careerStage: args.career_stage }; updates.push('Career Stage'); }
                if (args.goals) { updatedProfile = { ...updatedProfile, goals: args.goals }; updates.push('Goals'); }

                // Handle BrandKit (Identity + Release)
                const hasBrandUpdates = args.brand_description || args.colors || args.fonts || args.aesthetic_style || args.negative_prompt || args.social_twitter || args.social_instagram || args.social_spotify || args.social_soundcloud || args.social_bandcamp || args.social_beatport || args.social_website || args.pro_affiliation || args.distributor || args.visuals_acknowledged;
                const hasReleaseUpdates = args.release_title || args.release_type || args.release_artists || args.release_genre || args.release_mood || args.release_themes || args.release_lyrics;

                if (hasBrandUpdates || hasReleaseUpdates) {
                    const baseBrandKit = updatedProfile.brandKit || {
                        colors: [],
                        fonts: '',
                        brandDescription: '',
                        aestheticStyle: '',
                        negativePrompt: '',
                        socials: {},
                        brandAssets: [],
                        referenceImages: [],
                        releaseDetails: {
                            title: '', type: '', artists: '', genre: '', mood: '', themes: '', lyrics: ''
                        },
                        visualsAcknowledged: false
                    };

                    const newBrandKit: BrandKit = { ...baseBrandKit };

                    // Identity Updates
                    if (args.brand_description) { newBrandKit.brandDescription = args.brand_description; updates.push('Brand Description'); }
                    if (args.colors) { newBrandKit.colors = args.colors; updates.push('Colors'); }
                    if (args.fonts) { newBrandKit.fonts = args.fonts; updates.push('Fonts'); }
                    if (args.aesthetic_style) { newBrandKit.aestheticStyle = args.aesthetic_style; updates.push('Aesthetic Style'); }
                    if (args.negative_prompt) { newBrandKit.negativePrompt = args.negative_prompt; updates.push('Negative Prompt'); }
                    if (args.visuals_acknowledged) { newBrandKit.visualsAcknowledged = true; updates.push('Visual Assets Status'); }

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
                        updates.push('Socials & Pro Details');
                    }

                    // Release Updates
                    if (hasReleaseUpdates) {
                        newBrandKit.releaseDetails = {
                            ...(newBrandKit.releaseDetails || { title: '', type: '', artists: '', genre: '', mood: '', themes: '', lyrics: '' }),
                            ...(args.release_title && { title: args.release_title }),
                            ...(args.release_type && { type: args.release_type }),
                            ...(args.release_artists && { artists: args.release_artists }),
                            ...(args.release_genre && { genre: args.release_genre }),
                            ...(args.release_mood && { mood: args.release_mood }),
                            ...(args.release_themes && { themes: args.release_themes }),
                            ...(args.release_lyrics && { lyrics: args.release_lyrics }),
                        } as ReleaseDetails;
                        updates.push('Release Details');
                    }

                    updatedProfile = { ...updatedProfile, brandKit: newBrandKit };
                }
                break;
            }
            case OnboardingTools.AddImageAsset: {
                const args = call.args as unknown as AddImageAssetArgs;
                const file = files.find(f => f.file.name === args.file_name);
                if (file && file.base64) {
                    const newAsset: BrandAsset = {
                        url: `data:image/png;base64,${file.base64}`,
                        description: args.description,
                        category: args.category,
                        tags: args.tags,
                        subject: args.subject
                    };
                    const baseBrandKit = updatedProfile.brandKit || {
                        colors: [],
                        fonts: '',
                        brandDescription: '',
                        aestheticStyle: '',
                        negativePrompt: '',
                        socials: {},
                        brandAssets: [],
                        referenceImages: [],
                        releaseDetails: {
                            title: '', type: '', artists: '', genre: '', mood: '', themes: '', lyrics: ''
                        },
                        visualsAcknowledged: false
                    };
                    const newBrandKit: BrandKit = { ...baseBrandKit };

                    if (args.asset_type === 'brand_asset') {
                        newBrandKit.brandAssets = [...(newBrandKit.brandAssets || []), newAsset];
                        updates.push('Brand Asset');
                    } else if (args.asset_type === 'reference_image') {
                        newBrandKit.referenceImages = [...(newBrandKit.referenceImages || []), newAsset];
                        updates.push('Reference Image');
                    }
                    updatedProfile = { ...updatedProfile, brandKit: newBrandKit };
                }
                break;
            }
            case OnboardingTools.AddTextAssetToKnowledgeBase: {
                const args = call.args as unknown as AddTextAssetArgs;
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
                    updatedProfile = { ...updatedProfile, knowledgeBase: [...(updatedProfile.knowledgeBase || []), newDoc] };
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


// --- Content Generation ---

export async function generateSection(section: 'bio' | 'brand_description' | 'creative_preferences', userInput: string): Promise<string> {
    const systemPrompt = `You are a professional copywriter specializing in the music industry. Write a compelling, concise, and professional piece of content for the specified section. The tone should be authentic and engaging. Do not add any extra conversational text, just return the content.`;

    const response = await AI.generateContent(
        [{ role: 'user', parts: [{ text: `User Input: "${userInput}"\n\nWrite the ${section}.` }] }],
        AI_MODELS.TEXT.AGENT,
        {
            systemInstruction: systemPrompt,
            ...AI_CONFIG.THINKING.HIGH,
        }
    );
    return response.response.text().trim() || "";
}
