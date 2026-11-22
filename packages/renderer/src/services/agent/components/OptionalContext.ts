import { ContextPreparation } from './ContextPreparation';

/** Optional enrichment must leave time for required context and execution. */
export async function readOptionalContext<T>(
    stage: string,
    read: (signal: AbortSignal) => Promise<T>,
    timeoutMs: number,
    signal?: AbortSignal,
): Promise<{ value: T; unavailable?: never } | { value?: never; unavailable: string }> {
    signal?.throwIfAborted();
    const controller = new AbortController();
    const stop = () => controller.abort(signal?.reason);
    signal?.addEventListener('abort', stop, { once: true });
    try {
        const value = await new ContextPreparation(controller.signal, timeoutMs)
            .wait(stage, () => read(controller.signal));
        signal?.throwIfAborted();
        return { value };
    } catch (error) {
        signal?.throwIfAborted();
        return { unavailable: error instanceof Error ? error.message : String(error) };
    } finally {
        // Fence subsequent work in a serial enrichment after timeout or Stop.
        controller.abort();
        signal?.removeEventListener('abort', stop);
    }
}
