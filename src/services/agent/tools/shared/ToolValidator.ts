/* eslint-disable @typescript-eslint/no-explicit-any -- Service layer uses dynamic types for external API responses */
import { ZodType } from 'zod';
import { toolError } from '../../utils/ToolUtils';

/**
 * ToolValidator provides shared validation logic for agent tools.
 * It deduplicates common checks like project existence, argument types, and session state.
 */
export class ToolValidator {
    /**
     * Validates tool arguments against a Zod schema.
     */
    public static validateArgs<T>(args: any, schema: ZodType<T>): { success: true; data: T } | { success: false; error: any } {
        const result = schema.safeParse(args);
        if (!result.success) {
            return {
                success: false,
                error: toolError(`Invalid arguments: ${result.error.message}`, 'INVALID_ARGS')
            };
        }
        return { success: true, data: result.data };
    }

    /**
     * Common check for project ID validity.
     */
    public static async validateProject(projectId: string, toolContext: any): Promise<{ success: boolean; error?: string }> {
        if (!projectId) return { success: false, error: 'Project ID is required' };

        // Use provided toolContext or fallback to direct check
        const projects = toolContext?.get ? toolContext.get('projects') : [];
        const project = projects.find((p: any) => p.id === projectId);

        if (!project) return { success: false, error: `Project with ID ${projectId} not found` };
        return { success: true };
    }
}
