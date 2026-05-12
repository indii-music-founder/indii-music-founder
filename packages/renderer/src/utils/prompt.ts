/**
 * Trims leading whitespace from each line of a template literal.
 * This prevents "token bloat" where indentation is counted as tokens,
 * saving ~10-15% of prompt space while keeping source code readable.
 */
export function cleanPrompt(text: string): string {
    return text
        .split('\n')
        .map(line => line.trim())
        .filter(line => (line.length > 0 || line === '')) // preserve intentional empty lines for structure
        .join('\n')
        .trim();
}
