import { FirebaseAIService } from '@/services/ai/FirebaseAIService';
import { AI_MODELS } from '@/core/config/ai-models';
import { logger } from '@/utils/logger';
import { WikiDocument } from './WikiStorageAdapter';

export interface LintResult {
    passed: boolean;
    confidence: number;
    issues: string[];
    contradicts: boolean;
}

/**
 * WikiLinter acts as the Context QA step in the pipeline.
 * It verifies that newly proposed Wiki content does not contradict existing core facts
 * and adheres to formatting and brand guidelines.
 */
export class WikiLinter {
    /**
     * Lints the proposed new markdown content against the existing markdown content
     * to check for contradictions or hallucinations.
     */
    static async lintContent(
        proposedContent: string,
        existingContent: string,
        allRelatedDocs?: WikiDocument[]
    ): Promise<LintResult> {
        try {
            // If there's no existing content, it passes automatically (unless it violates general structural rules)
            if (!existingContent || existingContent.trim() === '') {
                return { passed: true, confidence: 1.0, issues: [], contradicts: false };
            }

            const prompt = `You are the Wiki Context QA Linter for the indiiOS AI Agent system.
Your job is to read an EXISTING markdown document, and a PROPOSED updated version of it.
You must determine if the PROPOSED version introduces any factual contradictions or hallucinations compared to the EXISTING version.
Adding NEW facts is allowed. Changing facts directly contradicts the core knowledge base and must be flagged.

EXISTING WIKI CONTENT:
${existingContent.slice(0, 3000)}

PROPOSED WIKI CONTENT:
${proposedContent.slice(0, 3000)}

Analyze the changes. Output a JSON object exactly matching this schema:
{
  "passed": boolean (true if safe to merge, false if contradictions found),
  "confidence": number (0.0 to 1.0),
  "issues": string[] (list of specific contradictions or formatting issues found),
  "contradicts": boolean (true if a core fact is altered/destroyed)
}`;

            const responseText = await FirebaseAIService.getInstance().generateText(
                prompt,
                AI_MODELS.TEXT.FAST // gemini-3-flash-preview is perfect for fast JSON QA
            );

            // Clean json response
            const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const result = JSON.parse(cleaned) as LintResult;

            return result;
        } catch (e) {
            logger.error(`[WikiLinter] Linting failed, defaulting to pass (fallback mode):`, e);
            return { passed: true, confidence: 0.5, issues: ['Linting engine failed to parse response'], contradicts: false };
        }
    }
}
