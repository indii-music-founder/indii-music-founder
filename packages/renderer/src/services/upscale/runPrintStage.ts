/** Bound a real print operation without allowing a late result to become success. */
export function runPrintStage<T>(
    stage: string,
    timeoutMs: number,
    operation: (signal: AbortSignal) => Promise<T>,
    signal?: AbortSignal,
    releaseLateResult?: (result: T) => void,
): Promise<T> {
    signal?.throwIfAborted();
    return new Promise<T>((resolve, reject) => {
        const controller = new AbortController();
        let pending = true;
        const cleanup = () => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', cancel);
        };
        const fail = (reason: unknown) => {
            if (!pending) return;
            pending = false;
            controller.abort(reason);
            cleanup();
            reject(reason);
        };
        const cancel = () => fail(signal?.reason ?? new DOMException('Print preparation cancelled.', 'AbortError'));
        const timer = setTimeout(() => fail(new Error(`${stage} did not finish in time. No print master was saved. You can retry or use the desktop app.`)), timeoutMs);
        signal?.addEventListener('abort', cancel, { once: true });
        Promise.resolve().then(() => {
            controller.signal.throwIfAborted();
            return operation(controller.signal);
        }).then(result => {
            if (!pending) {
                releaseLateResult?.(result);
                return;
            }
            pending = false;
            cleanup();
            resolve(result);
        }).catch(fail);
    });
}
