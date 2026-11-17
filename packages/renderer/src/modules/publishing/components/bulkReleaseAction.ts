export type BulkReleaseAction = 'delete' | 'archive';

export interface BulkReleaseResult {
    succeeded: string[];
    failed: string[];
}

/**
 * Runs the action for every id and records each outcome. Promise.all would
 * reject on the first failure and report "failed" for releases that were
 * already changed, leaving the UI and the user's mental model out of sync.
 */
export async function runBulkReleaseAction(
    ids: readonly string[],
    operation: (id: string) => Promise<unknown>,
): Promise<BulkReleaseResult> {
    const outcomes = await Promise.allSettled(ids.map(id => operation(id)));
    const result: BulkReleaseResult = { succeeded: [], failed: [] };
    outcomes.forEach((outcome, index) => {
        (outcome.status === 'fulfilled' ? result.succeeded : result.failed).push(ids[index]!);
    });
    return result;
}

export function describeBulkReleaseResult(
    action: BulkReleaseAction,
    result: BulkReleaseResult,
): { level: 'success' | 'error'; message: string } {
    const verb = action === 'delete' ? 'deleted' : 'archived';
    const noun = (count: number) => `${count} release${count === 1 ? '' : 's'}`;
    if (result.failed.length === 0) {
        return { level: 'success', message: `${noun(result.succeeded.length)} ${verb}.` };
    }
    if (result.succeeded.length === 0) {
        return { level: 'error', message: `Could not ${action} ${noun(result.failed.length)}.` };
    }
    return {
        level: 'error',
        message: `${noun(result.succeeded.length)} ${verb}; ${result.failed.length} could not be ${verb} and ${result.failed.length === 1 ? 'is' : 'are'} still selected.`,
    };
}
