import { InputSanitizer } from '@/services/ai/utils/InputSanitizer';

export interface PromptOptions {
    userPrompt: string;
    task?: string;
    constraints?: string[];
    useDualView?: boolean;
}

/**
 * PromptBuilder - Enforces the "Task-Inputs-Instruction" structure
 * for Gemini 3 ("Nano Banana") series multimodal editing.
 */
export class PromptBuilder {
    private static DEFAULT_CONSTRAINTS = [
        "Maintain consistent lighting, shadows, and texture from the source image",
        "Ensure seamless blending and edge refinement"
    ];

    /**
     * Builds a structured prompt for Dual-View (Source + Binary Mask)
     */
    static buildDualViewPrompt(options: PromptOptions): string {
        const sanitized = InputSanitizer.sanitize(options.userPrompt);
        const task = options.task || "Targeted Image Inpainting";
        const constraints = [...this.DEFAULT_CONSTRAINTS, ...(options.constraints || [])];

        return `TASK: ${task}.
INPUTS:
1. IMAGE_SOURCE: The original high-resolution photo.
2. IMAGE_MASK: A binary mask where WHITE pixels mark the target area.
INSTRUCTION:
- Analyze IMAGE_SOURCE for context, lighting, and depth.
- Identify the object or background area under the WHITE pixels in IMAGE_MASK.
- Refine the mask boundaries using your spatial reasoning for a better fit.
- Modify the target area to satisfy this request: ${sanitized}.
CONSTRAINTS:
${constraints.map(c => `- ${c}`).join('\n')}`;
    }

    /**
     * Builds a structured prompt for Visual Prompting (Red Overlay)
     */
    static buildVisualPrompt(options: PromptOptions): string {
        const sanitized = InputSanitizer.sanitize(options.userPrompt);
        const task = options.task || "Object Modification via Visual Prompt";
        const constraints = [...this.DEFAULT_CONSTRAINTS, ...(options.constraints || [])];

        return `TASK: ${task}.
INPUTS:
1. IMAGE_CANVAS: Photo with a translucent RED overlay highlight.
INSTRUCTION:
- Locate the RED highlighted regions in IMAGE_CANVAS.
- Infer the underlying object and refine the selection area.
- Transform the content inside the highlight to: ${sanitized}.
CONSTRAINTS:
${constraints.map(c => `- ${c}`).join('\n')}`;
    }

    /**
     * Helper to route to the correct builder
     */
    static build(options: PromptOptions): string {
        return options.useDualView ? this.buildDualViewPrompt(options) : this.buildVisualPrompt(options);
    }
}
