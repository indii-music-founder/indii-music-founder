import { firebaseAI } from '../ai/FirebaseAIService';
import { AI_MODELS } from '@/core/config/ai-models';
import { AICompositionSchema, AIComposition } from '@/modules/video/schemas/AICompositionSchema';

export interface CompositionOptions {
    duration?: number; // seconds
    aspectRatio?: '16:9' | '9:16' | '1:1';
    style?: string;
    signal?: AbortSignal;
}

const SYSTEM_PROMPT = `You are a professional video editor. Generate a video composition JSON.

RULES:
1. All frame numbers must be integers (fps=30, so 1 second = 30 frames)
2. Scene startFrames must not overlap
3. Element positions: use numbers (pixels) or "center"
4. Colors in hex format (#RRGGBB)
5. Ensure scenes sum to target duration

OUTPUT FORMAT:
{
  "version": "1.0",
  "metadata": { "title": "...", "description": "...", "mood": "...", "colorPalette": ["#..."] },
  "settings": { "width": 1920, "height": 1080, "fps": 30 },
  "scenes": [
    {
      "id": "scene-1",
      "name": "...",
      "startFrame": 0,
      "durationInFrames": 90,
      "background": { "type": "color", "value": "#000000" },
      "elements": [
        {
          "id": "text-1",
          "type": "text",
          "content": "...",
          "position": { "x": "center", "y": "center" },
          "style": { "fontSize": 72, "color": "#FFFFFF" },
          "animation": { "enter": "fade", "enterDuration": 15 }
        }
      ],
      "transition": { "type": "fade", "duration": 15 }
    }
  ],
  "audio": {}
}`;

export class VideoCompositionService {
    private static instance: VideoCompositionService;

    static getInstance(): VideoCompositionService {
        if (!this.instance) this.instance = new VideoCompositionService();
        return this.instance;
    }

    async generateComposition(prompt: string, options: CompositionOptions = {}): Promise<AIComposition> {
        const fps = 30;
        const targetFrames = (options.duration || 10) * fps;
        const dimensions = this.getResolution(options.aspectRatio || '16:9');

        const fullPrompt = `${SYSTEM_PROMPT}

TARGET:
- Duration: ${targetFrames} frames (${options.duration || 10} seconds)
- Resolution: ${dimensions.width}x${dimensions.height}
- FPS: ${fps}
${options.style ? `- Style: ${options.style}` : ''}

USER REQUEST:
${prompt}`;

        const result = await firebaseAI.generateStructuredData<AIComposition>(
            fullPrompt,
            this.getFirebaseSchema() as any, // Cast to any to satisfy the complex Schema type if strict check fails, but we added nullable below
            undefined,
            undefined,
            AI_MODELS.TEXT.AGENT
        );

        // Validate with Zod
        return AICompositionSchema.parse(result);
    }

    async enhanceComposition(composition: AIComposition, instruction: string): Promise<AIComposition> {
        const prompt = `Modify this composition: ${JSON.stringify(composition)}\n\nInstruction: ${instruction}`;
        return this.generateComposition(prompt);
    }

    private getResolution(aspectRatio: string): { width: number; height: number } {
        const map: Record<string, { width: number; height: number }> = {
            '16:9': { width: 1920, height: 1080 },
            '9:16': { width: 1080, height: 1920 },
            '1:1': { width: 1080, height: 1080 },
        };
        return map[aspectRatio] || map['16:9'];
    }

    private getFirebaseSchema() {
        // Simplified schema for Firebase AI
        return {
            type: 'object',
            nullable: false,
            properties: {
                version: { type: 'string', nullable: false },
                metadata: { type: 'object', nullable: false },
                settings: { type: 'object', nullable: false },
                scenes: { type: 'array', nullable: false },
                audio: { type: 'object', nullable: true },
            },
            required: ['version', 'metadata', 'settings', 'scenes'],
        };
    }
}

export const videoCompositionService = VideoCompositionService.getInstance();
