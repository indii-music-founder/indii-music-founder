export function detachSessionSocket<Socket>(
  pair: { worker?: Socket; client?: Socket; stop: () => void },
  kind: 'worker' | 'client',
  socket: Socket,
): boolean {
  if (pair[kind] !== socket) return false;
  pair[kind] = undefined;
  if (!pair.worker && !pair.client) pair.stop();
  return true;
}

/** Local subscriptions belong to a bounded socket pair, not a persisted filing. */
export class SessionResources {
  private stopped = false;
  private cleanups = new Set<() => void>();
  private expiry: ReturnType<typeof setTimeout>;

  constructor(
    expiresAtMs: number,
    private readonly onStop: () => void,
    private readonly onError: (error: unknown) => void,
  ) {
    if (!Number.isSafeInteger(expiresAtMs)) throw new Error('Invalid session expiry');
    this.expiry = setTimeout(() => this.stop(), Math.max(0, Math.min(expiresAtMs - Date.now(), 2_147_483_647)));
  }

  add(cleanup: () => void): void {
    if (this.stopped) this.run(cleanup);
    else this.cleanups.add(cleanup);
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    clearTimeout(this.expiry);
    // Remove the pair before closing sockets so close events cannot reuse it.
    this.run(this.onStop);
    for (const cleanup of this.cleanups) this.run(cleanup);
    this.cleanups.clear();
  }

  private run(cleanup: () => void): void {
    try { cleanup(); } catch (error) { this.onError(error); }
  }
}
