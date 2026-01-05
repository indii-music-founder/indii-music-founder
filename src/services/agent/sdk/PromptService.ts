/**
 * Service for managing and versioning prompts.
 * Allows for centralized prompt definitions and testing.
 */
export class PromptService {
    private static prompts: Map<string, { template: string, version: number }> = new Map();

    /**
     * Registers a prompt template.
     * @param id Unique identifier for the prompt
     * @param template The template string with {{variable}} placeholders
     * @param version Optional version number
     */
    static register(id: string, template: string, version = 1) {
        if (this.prompts.has(id)) {
            const existing = this.prompts.get(id)!;
            if (existing.version > version) {
                console.warn(`[PromptService] Ignored registration of older version for prompt '${id}'`);
                return;
            }
        }
        this.prompts.set(id, { template, version });
    }

    /**
     * Retrieves and interpolates a prompt.
     * @param id The prompt ID
     * @param variables Key-value pairs to replace {{key}} in the template
     * @returns The interpolated string
     * @throws Error if prompt not found
     */
    static get(id: string, variables: Record<string, string | number | boolean> = {}): string {
        const item = this.prompts.get(id);
        if (!item) {
            throw new Error(`[PromptService] Prompt '${id}' not found.`);
        }

        let output = item.template;
        for (const [key, value] of Object.entries(variables)) {
            // Replace {{key}} globaly
            const regex = new RegExp(`{{${key}}}`, 'g');
            output = output.replace(regex, String(value));
        }

        // Check for missing variables (optional strictly check)
        if (output.includes('{{') && output.includes('}}')) {
            console.warn(`[PromptService] Prompt '${id}' may have unresolved variables: ${output.match(/{{.*?}}/g)}`);
        }

        return output;
    }

    /**
     * Clears all registered prompts (useful for testing).
     */
    static clear() {
        this.prompts.clear();
    }
}
