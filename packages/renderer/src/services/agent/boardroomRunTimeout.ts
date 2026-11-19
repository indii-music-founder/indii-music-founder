import type { AgentMessage } from '@/core/store/slices/agent';

export const BOARDROOM_STILL_RUNNING_TEXT =
    'This request is still running or waiting for approval. Completion has not been verified. Keep this tab open or use Stop to cancel.';

/** Placeholders the Boardroom shows before a seat has produced real text. */
const BOARDROOM_PLACEHOLDERS = new Set([
    '',
    '*(Reviewing request...)*',
    '*(Reviewing previous discussion...)*',
    '*(Working on the assigned step…)*',
]);

/**
 * When the overall run timeout fires in the Boardroom, the first seat's reply
 * shares the run's response id. Replacing its text would erase an answer the
 * user already has (ISSUE-1656). Only a placeholder may be replaced; otherwise
 * the "still running" notice goes in a separate message.
 */
export function canReplaceOnBoardroomTimeout(message: Pick<AgentMessage, 'text'> | undefined): boolean {
    if (!message) return true;
    return BOARDROOM_PLACEHOLDERS.has((message.text ?? '').trim());
}

export const BOARDROOM_SEAT_TIMEOUT_MS = 300_000;

export interface SeatRunControl {
    /** Abort signal for this seat only; also fires when the run is stopped. */
    signal: AbortSignal;
    /** False once the seat finished or timed out; late events must be ignored. */
    isLive: () => boolean;
}

/**
 * Run one Boardroom seat with a hard timeout (ISSUE-1665). Unlike a bare
 * Promise.race, the timeout aborts the seat's work, clears its timer, and
 * marks it settled so late stream tokens cannot overwrite the timeout message.
 */
export function runSeatWithTimeout<T>(
    run: (control: SeatRunControl) => Promise<T>,
    { timeoutMs = BOARDROOM_SEAT_TIMEOUT_MS, parentSignal }: { timeoutMs?: number; parentSignal?: AbortSignal } = {},
): Promise<T> {
    const controller = new AbortController();
    let live = true;
    const onParentAbort = () => controller.abort(parentSignal?.reason);
    if (parentSignal?.aborted) controller.abort(parentSignal.reason);
    else parentSignal?.addEventListener('abort', onParentAbort, { once: true });

    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
            if (!live) return;
            live = false;
            const error = new Error(`Agent execution timed out (${Math.round(timeoutMs / 1000)}s)`);
            controller.abort(error);
            reject(error);
        }, timeoutMs);

        const settle = () => {
            live = false;
            clearTimeout(timer);
            parentSignal?.removeEventListener('abort', onParentAbort);
        };

        run({ signal: controller.signal, isLive: () => live }).then(
            value => { if (live) { settle(); resolve(value); } else settle(); },
            error => { if (live) { settle(); reject(error); } else settle(); },
        );
    });
}
