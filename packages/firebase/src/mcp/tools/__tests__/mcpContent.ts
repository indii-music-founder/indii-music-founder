/**
 * Shared test helper for reading text out of an MCP tool response.
 *
 * An MCP result's `content` is a union of block kinds (text | image | audio |
 * resource), so `result.content[0].text` does not typecheck — `text` exists on
 * only one member. Tests were reaching through that union, which is how
 * `packages/firebase`'s test files drifted while nothing checked them
 * (ISSUE-1212).
 *
 * This validates rather than casts past the union: if a tool ever starts
 * returning an image or resource block where a test expects text, this throws
 * with the actual block kind instead of silently yielding `undefined` and
 * failing somewhere less obvious.
 */
export function textContent(result: unknown, index = 0): string {
    const content = (result as { content?: unknown } | null | undefined)?.content;
    if (!Array.isArray(content)) {
        throw new Error('Expected an MCP result with a `content` array.');
    }

    const block: unknown = content[index];
    if (!block || typeof block !== 'object') {
        throw new Error(`Expected an MCP content block at index ${index}, found none.`);
    }

    const { type, text } = block as { type?: unknown; text?: unknown };
    if (type !== 'text' || typeof text !== 'string') {
        throw new Error(
            `Expected a text content block at index ${index}, got ${JSON.stringify(type) ?? 'unknown'}.`,
        );
    }
    return text;
}
