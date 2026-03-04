import { AgentContext, WhiskState } from '../types';

/**
 * AgentPromptBuilder handles the assembly of complex prompts for agents.
 * This includes logic for mission, context, brand identity, WHISK references, and history.
 */
export class AgentPromptBuilder {
    /**
     * Builds the full system prompt for an agent execution.
     */
    public static buildFullPrompt(
        systemPrompt: string,
        task: string,
        agentName: string,
        agentId: string,
        context: AgentContext | undefined,
        enrichedContext: any,
        safeHistory: string,
        superpowerPrompt: string,
        memorySection: string,
        distributorSection: string
    ): string {
        const whiskContext = context?.whiskState ? `\n${this.buildWhiskContext(context.whiskState)}\n` : '';

        return `
# MISSION
${systemPrompt}

# CONTEXT
${JSON.stringify(enrichedContext, null, 2)}

${context?.brandKit ? `
## BRAND & IDENTITY
- **Brand Description:** ${context.brandKit.brandDescription || 'Not provided'}
- **Aesthetic Style:** ${context.brandKit.aestheticStyle || 'Not provided'}
${context.brandKit.releaseDetails ? `
- **CURRENT PROJECT (ALBUM/SINGLE):** ${context.brandKit.releaseDetails.title || 'Untitled Project'}
- **ARTIST NAME:** ${context.brandKit.releaseDetails.artists || 'Unknown Artist'}
- **MOOD/THEME:** ${context.brandKit.releaseDetails.mood || 'N/A'}
` : ''}
` : ''}

${whiskContext}

# HISTORY
${safeHistory}
${memorySection}
${distributorSection}

${superpowerPrompt}

# CURRENT OBJECTIVE
${task}
`;
    }

    /**
     * Builds the Reference Mixer (WHISK) context block.
     */
    public static buildWhiskContext(whiskState: WhiskState): string {
        if (!whiskState) return '';
        const { subjects, scenes, styles, preciseReference } = whiskState;
        const lines: string[] = [];

        const checkedSubjects = subjects.filter(s => s.checked);
        const checkedScenes = scenes.filter(s => s.checked);
        const checkedStyles = styles.filter(s => s.checked);

        if (checkedSubjects.length === 0 && checkedScenes.length === 0 && checkedStyles.length === 0) {
            return '';
        }

        lines.push('## REFERENCE MIXER (WHISK) CONTEXT');
        lines.push(`- Precise Mode: ${preciseReference ? 'ON (strict adherence to references)' : 'OFF (creative freedom)'}`);
        lines.push('The following items are "Locked" in the Reference Mixer. They represent the current visual direction:');

        if (checkedSubjects.length > 0) {
            lines.push('- SUBJECTS: ' + checkedSubjects.map(s => s.aiCaption || s.content).join(', '));
        }
        if (checkedScenes.length > 0) {
            lines.push('- SCENES: ' + checkedScenes.map(s => s.aiCaption || s.content).join(', '));
        }
        if (checkedStyles.length > 0) {
            lines.push('- STYLES: ' + checkedStyles.map(s => s.aiCaption || s.content).join(', '));
        }

        lines.push('IMPORTANT: When generating images or videos, you MUST incorporate these locked references. Synthesize the subject, scene, and style into a cohesive prompt.');
        return lines.join('\n');
    }
}
