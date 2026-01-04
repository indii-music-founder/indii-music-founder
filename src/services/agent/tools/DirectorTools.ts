import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { VideoGeneration } from '@/services/video/VideoGenerationService';
import { Editing } from '@/services/image/EditingService';
import { useStore } from '@/core/store';

export const DirectorTools = {
    generate_image: async (args: { prompt: string, count?: number, negativePrompt?: string }) => {
        try {
            // Use VideoGeneration service's image generation (proxy to backend)
            // Or direct firebaseAI if available. Using VideoGeneration for consistency as it handles jobs.
            // Actually, let's use firebaseAI.generateImage directly to mimic "Generative AI" upgrade.
            // Actually, let's use firebaseAI.generateImage directly to mimic "Generative AI" upgrade.
            const base64 = await firebaseAI.generateImage(args.prompt, undefined, {
                negativePrompt: args.negativePrompt
            });

            // Mock saving to history since we don't have the full infrastructure here
            const url = `data:image/png;base64,${base64}`;
            const { addToHistory, currentProjectId } = useStore.getState();

            addToHistory({
                id: crypto.randomUUID(),
                url: url,
                prompt: args.prompt,
                type: 'image',
                timestamp: Date.now(),
                projectId: currentProjectId
            });

            // Return a summary instead of the full base64 string to prevent UI overflow
            return `Image generated successfully.`;
        } catch (e: any) {
            return `Image generation failed: ${e.message}`;
        }
    },

    batch_edit_images: async (args: { prompt: string, imageIndices?: number[] }) => {
        const { generatedHistory, addToHistory, currentProjectId } = useStore.getState();

        // Select images: defaults to the most recent one if no indices provided
        let targetImages: any[] = [];
        if (args.imageIndices && args.imageIndices.length > 0) {
            targetImages = args.imageIndices.map(i => generatedHistory[i]).filter(Boolean);
        } else if (generatedHistory.length > 0) {
            targetImages = [generatedHistory[0]];
        }

        if (targetImages.length === 0) return "No images found to edit.";

        try {
            // Fetch and convert to base64
            // Note: This assumes we can fetch the URLs. If they are local blobs, we need to handle that.
            const imagesData = await Promise.all(targetImages.map(async (img) => {
                const response = await fetch(img.url);
                const blob = await response.blob();
                const base64 = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });
                // Remove data prefix for EditingService if needed, but EditingService expects object
                const type = blob.type;
                const data = base64.split(',')[1];
                return { mimeType: type, data: data };
            }));

            const results = await Editing.batchEdit({
                images: imagesData,
                prompt: args.prompt
            });

            // Save to history
            results.forEach(res => {
                addToHistory({
                    id: res.id,
                    url: res.url,
                    prompt: res.prompt,
                    type: 'image',
                    timestamp: Date.now(),
                    projectId: currentProjectId
                });
            });

            return `Batch edit complete. Generated ${results.length} variations.`;
        } catch (e: any) {
            return `Batch edit failed: ${e.message}`;
        }
    },

    run_showroom_mockup: async (args: { productType: string, scenePrompt: string }) => {
        const fullPrompt = `Product photography of a ${args.productType}. ${args.scenePrompt}. High resolution, studio lighting.`;
        try {
            const base64 = await firebaseAI.generateImage(fullPrompt);
            return `Showroom mockup generated for ${args.productType}.`;
        } catch (e: any) {
            return `Showroom mockup failed: ${e.message}`;
        }
    },

    generate_high_res_asset: async (args: { prompt: string, templateType: string }) => {
        try {
            const fullPrompt = `High resolution asset for ${args.templateType}. ${args.prompt}. Print quality, 4k.`;
            const base64 = await firebaseAI.generateImage(fullPrompt);

            // Save to history
            const url = `data:image/png;base64,${base64}`;
            const { addToHistory, currentProjectId } = useStore.getState();

            addToHistory({
                id: crypto.randomUUID(),
                url: url,
                prompt: `High-Res Asset: ${args.templateType} - ${args.prompt}`,
                type: 'image',
                timestamp: Date.now(),
                projectId: currentProjectId
            });

            return `High-res asset generated for ${args.templateType}.`;
        } catch (e: any) {
            return `Asset generation failed: ${e.message}`;
        }
    },

    set_entity_anchor: async (args: { image: string }) => {
        const { setEntityAnchor, generatedHistory } = useStore.getState();
        // Find image object in history if 'image' arg is a URL or ID
        const found = generatedHistory.find(h => h.id === args.image || h.url === args.image);

        if (found) {
            setEntityAnchor(found);
            return "Entity anchor set to selected image.";
        }

        // Fallback: Create a temporary item if valid URL
        if (args.image.startsWith('http') || args.image.startsWith('data:')) {
            setEntityAnchor({
                id: crypto.randomUUID(),
                type: 'image',
                url: args.image,
                prompt: 'Anchor Image',
                timestamp: Date.now(),
                projectId: 'temp'
            });
            return "Entity anchor set from URL.";
        }

        return "Failed to set anchor: Image not found.";
    },

    render_cinematic_grid: async (args: { prompt: string }) => {
        const gridPrompt = `Cinematic storyboard grid for: ${args.prompt}. Split into 4 panels. Wide, Close-up, Establishing, Detail.`;
        try {
            const base64 = await firebaseAI.generateImage(gridPrompt);
            return "Cinematic grid rendered.";
        } catch (e: any) {
            return `Grid render failed: ${e.message}`;
        }
    },

    extract_grid_frame: async (args: { gridIndex: number }) => {
        const { generatedHistory, addToHistory, currentProjectId } = useStore.getState();
        if (generatedHistory.length === 0) return "No grid available to extract from.";

        const gridImage = generatedHistory[0]; // Assume most recent is the grid

        try {
            // Fetch grid image
            const response = await fetch(gridImage.url);
            const blob = await response.blob();
            const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            });
            const data = base64.split(',')[1];

            // Use AI to extract/crop
            const extractPrompt = `Extract panel number ${args.gridIndex} from this storyboard grid. Return only that single frame as a high-quality image.`;

            // Usage of rawGenerateContent to get image output if model supports it (Gemini 2/3)
            // Or we use generateImage with the grid as reference? EditingService.editImage might be better if we treat it as a crop/mask?
            // Let's use firebaseAI.generateImage but usually it doesn't take input.
            // Actually, we can use EditingService.editImage with a prompt "Crop to panel X".

            const result = await Editing.editImage({
                image: { mimeType: blob.type, data: data },
                prompt: `Crop to panel ${args.gridIndex}. Clean borders. High resolution.`
            });

            if (result) {
                addToHistory({
                    id: result.id,
                    url: result.url,
                    prompt: `Extracted Frame ${args.gridIndex}`,
                    type: 'image',
                    timestamp: Date.now(),
                    projectId: currentProjectId
                });
                return `Frame ${args.gridIndex} extracted.`;
            }

            return "Extraction failed: No result returned.";

        } catch (e: any) {
            return `Frame extraction failed: ${e.message}`;
        }
    }
};
