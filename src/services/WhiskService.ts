import { WhiskState, WhiskItem } from '@/core/store/slices/creativeSlice';
import { ImageGeneration } from './image/ImageGenerationService';
import { AI_MODELS } from '@/core/config/ai-models';

// Inspiration prompts for each category
const INSPIRATION_SYSTEM_PROMPTS: Record<'subject' | 'scene' | 'style', string> = {
    subject: `You are a creative director for music artists. Generate 4 unique, evocative subject ideas for AI image generation. Focus on:
- Characters (singers, musicians, abstract figures)
- Objects (instruments, microphones, vinyl records, headphones)
- Animals with personality (fox with golden fur, raven in moonlight)
- Symbolic elements (masks, crowns, wings)
Return ONLY a JSON array of 4 short descriptions (max 15 words each). No explanations.`,

    scene: `You are a creative director for music artists. Generate 4 unique, atmospheric scene/background ideas for AI image generation. Focus on:
- Concert venues (neon-lit stage, intimate jazz club, festival crowd)
- Urban environments (rooftop at sunset, graffiti alley, rainy city street)
- Nature settings (misty forest, desert under stars, ocean waves)
- Abstract/surreal spaces (floating platforms, geometric dreamscape)
Return ONLY a JSON array of 4 short descriptions (max 15 words each). No explanations.`,

    style: `You are a creative director for music artists. Generate 4 unique artistic style ideas for AI image generation. Focus on:
- Art movements (vaporwave, synthwave, gothic, baroque, minimalist)
- Techniques (double exposure, glitch art, pointillism, watercolor)
- Media types (vintage film grain, polaroid, 3D render, vector art)
- Moods (dreamlike, gritty, nostalgic, futuristic)
Return ONLY a JSON array of 4 short descriptions (max 15 words each). No explanations.`
};

export class WhiskService {
    /**
     * Synthesizes a complex prompt from the user's action prompt and locked Whisk references.
     */
    static synthesizeWhiskPrompt(actionPrompt: string, whiskState: WhiskState): string {
        const { subjects, scenes, styles } = whiskState;

        const activeSubjects = subjects.filter(i => i.checked);
        const activeScenes = scenes.filter(i => i.checked);
        const activeStyles = styles.filter(i => i.checked);

        let finalPrompt = actionPrompt;

        // 1. Subject Injection
        if (activeSubjects.length > 0) {
            const subjectDescs = activeSubjects.map(s => s.aiCaption || s.content);
            if (activeSubjects.length === 1) {
                finalPrompt = `${subjectDescs[0]}, ${finalPrompt}`;
            } else {
                finalPrompt = `A group featuring ${subjectDescs.join(' and ')}, ${finalPrompt}`;
            }
        }

        // 2. Scene Injection
        if (activeScenes.length > 0) {
            const sceneDescs = activeScenes.map(s => s.aiCaption || s.content);
            finalPrompt = `${finalPrompt} in a setting described as: ${sceneDescs.join(', ')}`;
        }

        // 3. Style Injection
        if (activeStyles.length > 0) {
            const styleDescs = activeStyles.map(s => s.aiCaption || s.content);
            const styleString = styleDescs.join(', ');

            if (activeScenes.length === 0) {
                // If no scene, apply style to background
                finalPrompt = `${finalPrompt}, with a background in the style of ${styleString}`;
            } else {
                finalPrompt = `${finalPrompt}, overall style: ${styleString}`;
            }

            // Add style keywords commonly used for technical rendering
            finalPrompt = `${finalPrompt} --stylized: ${styleString}`;
        }

        return finalPrompt;
    }

    /**
     * Prepares source images for the generation request based on the "Precise" toggle.
     */
    static getSourceImages(whiskState: WhiskState): { mimeType: string; data: string }[] | undefined {
        if (!whiskState.preciseReference) return undefined;

        const allActiveRefs = [
            ...whiskState.subjects.filter(i => i.checked),
            ...whiskState.scenes.filter(i => i.checked),
            ...whiskState.styles.filter(i => i.checked)
        ];

        const imageRefs = allActiveRefs.filter(i => i.type === 'image');

        if (imageRefs.length === 0) return undefined;

        return imageRefs.map(item => {
            const [mimeType, b64] = item.content.split(',');
            const pureMime = mimeType.split(':')[1].split(';')[0];
            return { mimeType: pureMime, data: b64 };
        });
    }

    /**
     * Generates creative text suggestions for a given category using Gemini.
     */
    static async generateInspiration(category: 'subject' | 'scene' | 'style'): Promise<string[]> {
        try {
            const { GoogleGenAI } = await import('@google/genai');
            const { firebaseConfig } = await import('@/config/env');

            const config = firebaseConfig;
            const ai = new GoogleGenAI({ apiKey: config.apiKey });

            const response = await ai.models.generateContent({
                model: AI_MODELS.TEXT.FAST,
                contents: [{ role: 'user', parts: [{ text: 'Generate inspiration ideas now.' }] }],
                config: {
                    systemInstruction: INSPIRATION_SYSTEM_PROMPTS[category],
                    temperature: 1.0,
                    maxOutputTokens: 500,
                }
            });

            const text = response.text?.trim() || '[]';
            // Parse JSON array from response
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            return [];
        } catch (error) {
            console.error('WhiskService.generateInspiration error:', error);
            // Strict No Mock policy: Return empty array on failure
            return [];
        }
    }

    /**
     * Generates an inspiration sample image for a category.
     */
    static async generateInspirationImage(category: 'subject' | 'scene' | 'style', prompt: string): Promise<string | null> {
        try {
            const results = await ImageGeneration.generateImages({
                prompt: `${prompt}, high quality, artistic, music industry aesthetic`,
                count: 1,
                aspectRatio: '1:1',
                resolution: '1024x1024'
            });

            if (results.length > 0) {
                return results[0].url;
            }
            return null;
        } catch (error) {
            console.error('WhiskService.generateInspirationImage error:', error);
            return null;
        }
    }
}

