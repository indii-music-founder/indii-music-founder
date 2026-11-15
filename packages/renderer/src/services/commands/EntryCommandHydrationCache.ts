/** Tracks completed reads within one account lifetime. No persisted user data. */
export class EntryCommandHydrationCache {
  private generation = 0;
  private completed = new Set<string>();

  begin(): number { return this.generation; }
  has(key: string): boolean { return this.completed.has(key); }
  isCurrent(generation: number): boolean { return generation === this.generation; }
  complete(key: string, generation: number): boolean {
    if (!this.isCurrent(generation)) return false;
    this.completed.add(key);
    return true;
  }
  reset(): void {
    this.generation += 1;
    this.completed.clear();
  }
}

export const entryCommandHydrationCache = new EntryCommandHydrationCache();
