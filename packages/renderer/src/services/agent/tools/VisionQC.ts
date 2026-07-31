import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';
import { INTELLIGENCE_MODELS } from '@/core/config/intelligence-models';

export interface BrandKit {
  primaryColors: string[];
  forbiddenElements: string[];
  vibe: string;
}

/**
 * Evaluates an AI generated image against the artist's Brand Kit
 * to prevent "entropy" or off-brand ad creatives from going live.
 */
export async function runCreativeVisionCheck(
  base64Image: string, 
  brandKit: BrandKit
): Promise<{ approved: boolean; reason: string }> {
  
  const prompt = `
    You are the Creative Director Agent for a music artist.
    Review this proposed ad creative against the artist's Brand Kit.

    Brand Kit:
    - Primary Colors: ${brandKit.primaryColors.join(', ')}
    - Forbidden Elements: ${brandKit.forbiddenElements.join(', ')}
    - Overall Vibe: ${brandKit.vibe}

    Analyze the image. 
    1. Are any forbidden elements present?
    2. Does it heavily feature the primary colors?
    3. Does it match the overall vibe?

    Return a JSON response with exactly two keys:
    {
      "approved": boolean,
      "reason": "Brief explanation of your decision"
    }
  `;

  try {
    const parts = [
      { text: prompt },
      { inlineData: { data: base64Image, mimeType: 'image/jpeg' } }
    ];

    const result = await AutonomousIntelligence.generateStructuredData<{ approved: boolean; reason: string }>(
      parts,
      undefined,
      {},
      undefined,
      INTELLIGENCE_MODELS.TEXT.AGENT
    );

    return {
      approved: Boolean(result.approved),
      reason: String(result.reason || 'Evaluation completed.')
    };

  } catch (error: unknown) {
    console.error("Vision QC failed:", error);
    return { approved: false, reason: "Vision model evaluation failed to execute." };
  }
}
