/** Local transport identity only. Server authorization and control fences remain authoritative. */
export class HostedRightsConnectionLifecycle {
  private generation = 0;
  private state: 'idle' | 'connecting' | 'connected' | 'waiting' | 'closed' = 'idle';

  begin(): number | undefined {
    if (this.state !== 'idle' && this.state !== 'waiting') return undefined;
    this.state = 'connecting';
    return ++this.generation;
  }

  isCurrent(generation: number): boolean {
    return generation === this.generation && (this.state === 'connecting' || this.state === 'connected');
  }

  connected(generation: number): boolean {
    if (!this.isCurrent(generation) || this.state !== 'connecting') return false;
    this.state = 'connected';
    return true;
  }

  disconnected(generation: number): boolean {
    if (!this.isCurrent(generation)) return false;
    this.state = 'waiting';
    return true;
  }

  canRetry(generation: number): boolean {
    return generation === this.generation && this.state === 'waiting';
  }

  get isConnected(): boolean { return this.state === 'connected'; }

  close(): void {
    this.state = 'closed';
    ++this.generation;
  }
}
