import { WhiskState, WhiskItem } from '@/core/store/slices/creativeSlice';
import { ImageGeneration } from './image/ImageGenerationService';

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
}
