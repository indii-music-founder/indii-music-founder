/**
 * packages/renderer/src/services/agent/tools/ArtistDirectiveTools.ts
 *
 * Tier 0 Artist Master Directive Tools.
 *
 * Exposes bidirectional inspection and calibration tools to the Conductor agent swarm:
 * - read_artist_directive: Inspects the artist's living playbook or specific sections.
 * - refine_artist_directive: Modifies or appends rules/guidelines dynamically based
 *   on user conversations, mastering feedback, or legal constraints.
 */

import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import { artistDirectiveService } from '../skills/ArtistDirectiveService';
import {
    DIRECTIVE_SECTION_KEYS,
    compileDirectiveToMarkdown,
    type DirectiveSectionKey,
} from '@indii/shared';
import { AnyToolFunction } from '../types';

export const read_artist_directive = wrapTool(
    'read_artist_directive',
    async (args: { sectionKey?: string }) => {
        const { sectionKey } = args;
        const directive = await artistDirectiveService.getDirective();

        if (sectionKey) {
            if (!DIRECTIVE_SECTION_KEYS.includes(sectionKey as DirectiveSectionKey)) {
                return toolError(
                    `Invalid sectionKey "${sectionKey}". Valid sections are: ${DIRECTIVE_SECTION_KEYS.join(', ')}`
                );
            }

            const section = directive.sections[sectionKey as DirectiveSectionKey];
            return toolSuccess(
                {
                    sectionKey,
                    title: section.title,
                    description: section.description,
                    content: section.content,
                    rules: section.rules,
                    updatedAt: section.updatedAt,
                },
                `Successfully loaded Artist Master Directive section "${section.title}".`
            );
        }

        const formattedMarkdown = compileDirectiveToMarkdown(directive);
        return toolSuccess(
            {
                directive,
                formattedMarkdown,
            },
            `Artist Master Directive for "${directive.artistName}" loaded successfully.`
        );
    }
);

export const refine_artist_directive = wrapTool(
    'refine_artist_directive',
    async (args: {
        sectionKey: string;
        ruleOrContent: string;
        action: 'add_rule' | 'remove_rule' | 'set_content';
        reason?: string;
    }) => {
        const { sectionKey, ruleOrContent, action, reason } = args;

        if (!sectionKey) {
            return toolError('refine_artist_directive requires a sectionKey.');
        }

        if (!DIRECTIVE_SECTION_KEYS.includes(sectionKey as DirectiveSectionKey)) {
            return toolError(
                `Invalid sectionKey "${sectionKey}". Valid sections are: ${DIRECTIVE_SECTION_KEYS.join(', ')}`
            );
        }

        if (!['add_rule', 'remove_rule', 'set_content'].includes(action)) {
            return toolError('Invalid action. Must be one of: "add_rule", "remove_rule", "set_content".');
        }

        if (typeof ruleOrContent !== 'string' || !ruleOrContent.trim()) {
            return toolError('ruleOrContent must be a non-empty string.');
        }

        const result = await artistDirectiveService.refineSection(
            sectionKey as DirectiveSectionKey,
            ruleOrContent,
            action,
            reason || 'Reflected from artist interaction',
            'agent'
        );

        if (!result.success) {
            return toolError(`Failed to refine directive: ${result.error || 'Unknown error'}`);
        }

        return toolSuccess(
            {
                sectionKey,
                action,
                reason: reason || 'Reflected from artist interaction',
                updatedSection: result.directive?.sections[sectionKey as DirectiveSectionKey],
            },
            `Artist Master Directive section "${sectionKey}" successfully updated (${action}).`
        );
    }
);

export const ArtistDirectiveTools: Record<string, AnyToolFunction> = {
    read_artist_directive,
    refine_artist_directive,
};
