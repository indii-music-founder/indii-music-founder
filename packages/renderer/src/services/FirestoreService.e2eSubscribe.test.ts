import { describe, it, expect, vi } from 'vitest';
import { FirestoreService } from './FirestoreService';

vi.mock('@/utils/e2eMode', () => ({ isFirebaseE2EMockEnabled: () => true }));

interface Item { name: string }

describe('FirestoreService e2e mock mode subscriptions', () => {
    it('re-emits to existing subscribers when a document is added, updated or deleted', async () => {
        const service = new FirestoreService<Item>('e2e-subscribe-test');
        const seen: string[][] = [];
        const unsubscribe = service.subscribe([], items => seen.push(items.map(item => item.name)));
        await vi.waitFor(() => expect(seen).toEqual([[]]));

        const id = await service.add({ name: 'first' });
        await vi.waitFor(() => expect(seen.at(-1)).toEqual(['first']));

        await service.update(id, { name: 'renamed' });
        await vi.waitFor(() => expect(seen.at(-1)).toEqual(['renamed']));

        await service.delete(id);
        await vi.waitFor(() => expect(seen.at(-1)).toEqual([]));

        unsubscribe();
        await service.add({ name: 'after unsubscribe' });
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(seen.at(-1)).toEqual([]);
    });

    it('only notifies subscribers of the changed collection', async () => {
        const a = new FirestoreService<Item>('e2e-collection-a');
        const b = new FirestoreService<Item>('e2e-collection-b');
        const seenA: string[][] = [];
        const stop = a.subscribe([], items => seenA.push(items.map(item => item.name)));
        await vi.waitFor(() => expect(seenA).toHaveLength(1));
        await b.add({ name: 'other collection' });
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(seenA).toHaveLength(1);
        stop();
    });
});
