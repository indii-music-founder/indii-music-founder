import { describe, expect, it } from 'vitest';
import { CutGraph } from '../segmentation/MaxFlow';

describe('PhotoCraft graph port', () => {
    it('agrees with exhaustive minimum cuts including the returned foreground labels', () => {
        let seed = 173;
        const next = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % 11; };
        const graph = new CutGraph(6, 15);
        for (let trial = 0; trial < 100; trial++) {
            const count = 2 + next() % 5;
            graph.reset(count);
            const terminals = Array.from({ length: count }, () => [next(), next()] as const);
            const edges: { from: number; to: number; forward: number; reverse: number }[] = [];
            for (let from = 0; from < count; from++) for (let to = from + 1; to < count; to++) {
                if (next() > 3) edges.push({ from, to, forward: next(), reverse: next() });
            }
            terminals.forEach(([source, sink], node) => graph.terminals(node, source, sink));
            edges.forEach(edge => graph.edge(edge.from, edge.to, edge.forward, edge.reverse));
            const energy = (mask: number) => {
                let total = terminals.reduce((sum, [source, sink], node) => sum + (mask & (1 << node) ? sink : source), 0);
                for (const edge of edges) {
                    const sourceSide = Boolean(mask & (1 << edge.from)), targetSide = Boolean(mask & (1 << edge.to));
                    if (sourceSide && !targetSide) total += edge.forward;
                    if (!sourceSide && targetSide) total += edge.reverse;
                }
                return total;
            };
            let best = Infinity;
            for (let mask = 0; mask < 1 << count; mask++) best = Math.min(best, energy(mask));
            expect(graph.maxFlow(), `flow trial ${trial}`).toBeCloseTo(best, 8);
            const mask = Array.from({ length: count }).reduce<number>((mask, _, node) => mask | (graph.inSource(node) ? 1 << node : 0), 0);
            expect(energy(mask), `labels trial ${trial}`).toBeCloseTo(best, 8);
        }
    });
    it('clears residual capacities, flow and adjacency when a workspace shrinks and grows', () => {
        const graph = new CutGraph(4, 3);
        graph.terminals(0, 20, 0); graph.terminals(3, 0, 20);
        graph.edge(0, 3, 7, 1);
        expect(graph.maxFlow()).toBe(7);
        graph.reset(2);
        expect(graph.inSource(0)).toBe(false); expect(graph.inSource(1)).toBe(false);
        graph.terminals(0, 0, 4); graph.terminals(1, 6, 0);
        expect(graph.maxFlow()).toBe(0);
        expect(graph.inSource(0)).toBe(false); expect(graph.inSource(1)).toBe(true);
        expect(() => graph.edge(0, 3, 1, 1)).toThrow(/node/);
        graph.reset(4);
        graph.terminals(3, 12, 5);
        expect(graph.maxFlow()).toBe(5); expect(graph.inSource(3)).toBe(true);
        expect(() => graph.reset(5)).toThrow(/workspace/);
        expect(() => graph.reset(0)).toThrow(/workspace/);
    });
    it('accumulates terminal weights and rejects invalid graph inputs', () => {
        const graph = new CutGraph(2, 1);
        graph.terminals(0, 2.5, 0); graph.terminals(0, 1.25, 0);
        graph.terminals(1, 0, 10); graph.edge(0, 1, 3, 3);
        expect(graph.maxFlow()).toBeCloseTo(3);
        expect(graph.inSource(0)).toBe(true); expect(graph.inSource(1)).toBe(false);
        expect(() => new CutGraph(300001, 0)).toThrow(/limits/);
        expect(() => graph.terminals(0, NaN, 1)).toThrow(/capacity/);
        expect(() => graph.edge(0, 0, 1, 1)).toThrow(/edge/);
    });
});
