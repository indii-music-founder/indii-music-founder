/**
 * Mocked AI stream bodies that honor the real backend contract.
 *
 * The agent stream endpoints (packages/firebase/src/index.ts, streaming/
 * agentStream.ts) end every successful stream with a `{ complete: true }`
 * line, written only after the billing reservation settles. The client
 * (FirebaseIntelligenceService) rejects a stream without it:
 * "AI stream ended before billing settlement completed."
 *
 * Every e2e mock of an AI stream route must build its body with
 * `aiStreamBody(...)` so mocks can't drift from that contract again.
 */
export const AI_STREAM_COMPLETE_MARKER = { complete: true } as const;

export function aiStreamBody(...payloads: unknown[]): string {
    return [...payloads, AI_STREAM_COMPLETE_MARKER]
        .map((payload) => `data: ${JSON.stringify(payload)}\n\n`)
        .join('');
}

/**
 * The agent prompt (AgentPromptBuilder.buildFullPrompt) ends with
 *   # CURRENT OBJECTIVE (AUTHORITATIVE — EXECUTE THIS REQUEST NOW)
 *   <task>
 * where <task> starts with the user's own words, followed by runtime-appended
 * blocks (seated agents, tool notes, "[SYSTEM — FINAL STEP]" nudges, …).
 * Returns the first line of that task — what the user actually asked — or
 * null when the prompt has no objective marker.
 */
export const CURRENT_OBJECTIVE_MARKER = '# CURRENT OBJECTIVE';

export function extractCurrentObjective(prompt: string): string | null {
    const at = prompt.lastIndexOf(CURRENT_OBJECTIVE_MARKER);
    if (at === -1) return null;
    const afterHeading = prompt.slice(prompt.indexOf('\n', at) + 1);
    const firstLine = afterHeading.split('\n').map((line) => line.trim()).find(Boolean);
    return firstLine ?? null;
}
