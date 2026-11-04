/** Settle a delegated run when its parent cancels or its deadline expires. */
export async function runWithAgentDeadline<T>(
    execute: (signal: AbortSignal) => Promise<T>,
    parentSignal: AbortSignal | undefined,
    timeoutMs: number,
    onTimeout: () => void,
): Promise<T> {
    const controller = new AbortController();
    let rejectStop!: (error: Error) => void;
    const stopped = new Promise<never>((_, reject) => { rejectStop = reject; });
    const cancel = () => {
        const reason = parentSignal?.reason;
        const error = reason instanceof Error ? reason : new Error('Agent execution cancelled by parent.');
        controller.abort(error);
        rejectStop(error);
    };

    if (parentSignal?.aborted) {
        cancel();
        return stopped;
    }

    parentSignal?.addEventListener('abort', cancel, { once: true });
    const timeoutId = setTimeout(() => {
        const error = new Error(`Agent execution timed out after ${timeoutMs / 1000}s.`);
        controller.abort(error);
        rejectStop(error);
        onTimeout();
    }, timeoutMs);

    try {
        return await Promise.race([execute(controller.signal), stopped]);
    } finally {
        clearTimeout(timeoutId);
        parentSignal?.removeEventListener('abort', cancel);
    }
}
