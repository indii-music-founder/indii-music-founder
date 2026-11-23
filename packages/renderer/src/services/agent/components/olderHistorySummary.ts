/**
 * ISSUE-1661: agents build their prompt history from the structured recent
 * turns, which dropped the older-conversation summary the pipeline paid for.
 * Put it in front of the recent turns when there is one.
 */
export function withOlderHistorySummary(recentHistory: string, historicalSummary: unknown): string {
    if (typeof historicalSummary !== 'string' || !historicalSummary.trim()) return recentHistory;
    return `## Conversation Summary (older turns)\n${historicalSummary.trim()}\n\n## Recent Exchange\n${recentHistory}`;
}
