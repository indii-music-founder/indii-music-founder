/*!
 * TypeScript adaptation of PhotoCraft's Boykov–Kolmogorov graph implementation.
 * Source: storytold/photocraft bb3108cfd28a1cc84a9ae3b83531891f36a736fd
 * crates/algo/src/segment/maxflow.rs
 * Copyright (c) 2026 ArtCraft Team and the PhotoCraft contributors
 * MIT License. Full license: ./PHOTOCRAFT-LICENSE.txt
 */
const NONE = -1, TERMINAL = -2, ORPHAN = -3, EPS = 1e-5;
class Queue {
    private data: Int32Array;
    private start = 0;
    private length = 0;
    constructor(size: number) { this.data = new Int32Array(Math.max(8, size)); }
    private reserve() {
        if (this.length < this.data.length) return;
        const larger = new Int32Array(this.data.length * 2);
        for (let i = 0; i < this.length; i++) larger[i] = this.data[(this.start + i) % this.data.length]!;
        this.data = larger; this.start = 0;
    }
    push(value: number) { this.reserve(); this.data[(this.start + this.length++) % this.data.length] = value; }
    front(value: number) { this.reserve(); this.start = (this.start - 1 + this.data.length) % this.data.length; this.data[this.start] = value; this.length++; }
    pop(): number | undefined {
        if (!this.length) return undefined;
        const value = this.data[this.start]!;
        this.start = (this.start + 1) % this.data.length; this.length--;
        return value;
    }
}

/** Residual source/sink trees; typed arrays keep image-grid memory bounded. */
export class CutGraph {
    private first: Int32Array;
    private terminal: Float64Array;
    private parent: Int32Array;
    private sink: Uint8Array;
    private timestamp: Uint32Array;
    private distance: Uint32Array;
    private active: Uint8Array;
    private head: Int32Array;
    private next: Int32Array;
    private capacity: Float64Array;
    private arcs = 0;
    private flow = 0;
    private readonly nodeCapacity: number;
    get nodes(): number { return this.nodeCount; }
    constructor(private nodeCount: number, edgePairs: number) {
        const nodes = nodeCount;
        if (!Number.isInteger(nodes) || nodes < 1 || nodes > 300_000 || !Number.isInteger(edgePairs) || edgePairs < 0 || edgePairs > 1_200_000) throw new Error('Cutout graph exceeds processing limits');
        this.nodeCapacity = nodes;
        this.first = new Int32Array(nodes).fill(NONE); this.terminal = new Float64Array(nodes);
        this.parent = new Int32Array(nodes).fill(NONE); this.sink = new Uint8Array(nodes);
        this.timestamp = new Uint32Array(nodes); this.distance = new Uint32Array(nodes); this.active = new Uint8Array(nodes);
        this.head = new Int32Array(edgePairs * 2); this.next = new Int32Array(edgePairs * 2); this.capacity = new Float64Array(edgePairs * 2);
    }
    /** Discard residual flow/adjacency while retaining the bounded allocation. */
    reset(nodes = this.nodes): void {
        if (!Number.isInteger(nodes) || nodes < 1 || nodes > this.nodeCapacity) throw new Error('Cutout graph exceeds its workspace');
        this.nodeCount = nodes;
        this.first.fill(NONE, 0, nodes);
        this.parent.fill(NONE, 0, nodes);
        this.terminal.fill(0, 0, nodes);
        this.arcs = 0; this.flow = 0;
    }
    private checkNode(node: number) { if (!Number.isInteger(node) || node < 0 || node >= this.nodes) throw new Error('Invalid cutout graph node'); }
    private checkCapacity(value: number) { if (!Number.isFinite(value) || value < 0) throw new Error('Invalid cutout graph capacity'); }
    terminals(node: number, source: number, sink: number): void {
        this.checkNode(node); this.checkCapacity(source); this.checkCapacity(sink);
        const delta = this.terminal[node]!;
        if (delta > 0) source += delta; else sink -= delta;
        this.flow += Math.min(source, sink); this.terminal[node] = source - sink;
    }
    edge(from: number, to: number, forward: number, reverse: number): void {
        this.checkNode(from); this.checkNode(to); this.checkCapacity(forward); this.checkCapacity(reverse);
        if (from === to || this.arcs + 2 > this.head.length) throw new Error('Invalid cutout graph edge');
        const a = this.arcs;
        this.head[a] = to; this.next[a] = this.first[from]!; this.capacity[a] = forward; this.first[from] = a;
        this.head[a + 1] = from; this.next[a + 1] = this.first[to]!; this.capacity[a + 1] = reverse; this.first[to] = a + 1;
        this.arcs += 2;
    }
    inSource(node: number): boolean { return this.parent[node] !== NONE && !this.sink[node]; }
    maxFlow(): number {
        const queue = new Queue(this.nodes), orphans = new Queue(this.nodes);
        for (let i = 0; i < this.nodes; i++) {
            this.active[i] = 0; this.timestamp[i] = 0;
            if (Math.abs(this.terminal[i]!) > EPS) {
                this.sink[i] = this.terminal[i]! < 0 ? 1 : 0; this.parent[i] = TERMINAL;
                this.distance[i] = 1; this.active[i] = 1; queue.push(i);
            } else this.parent[i] = NONE;
        }
        let time = 0, i: number | undefined;
        while ((i = queue.pop()) !== undefined) {
            this.active[i] = 0;
            if (this.parent[i] === NONE) continue;
            let contact = NONE;
            const sink = this.sink[i]!;
            for (let a = this.first[i]!; a !== NONE; a = this.next[a]!) {
                const j = this.head[a]!;
                const cap = this.capacity[sink ? a ^ 1 : a]!;
                if (cap <= EPS) continue;
                if (this.parent[j] === NONE) {
                    this.sink[j] = sink; this.parent[j] = a ^ 1;
                    this.timestamp[j] = this.timestamp[i]!; this.distance[j] = this.distance[i]! + 1;
                    if (!this.active[j]) { this.active[j] = 1; queue.push(j); }
                } else if (this.sink[j] !== sink) { contact = sink ? a ^ 1 : a; break; }
                else if (this.timestamp[j]! <= this.timestamp[i]! && this.distance[j]! > this.distance[i]! + 1) {
                    this.parent[j] = a ^ 1; this.timestamp[j] = this.timestamp[i]!; this.distance[j] = this.distance[i]! + 1;
                }
            }
            if (contact === NONE) continue;
            if (!this.active[i]) { this.active[i] = 1; queue.front(i); }
            this.augment(contact, orphans); time++;
            let orphan: number | undefined;
            while ((orphan = orphans.pop()) !== undefined) this.adopt(orphan, time, queue, orphans);
        }
        return this.flow;
    }
    private augment(edge: number, orphans: Queue): void {
        const source = this.head[edge ^ 1]!, sink = this.head[edge]!;
        let amount = this.capacity[edge]!, x = source;
        while (this.parent[x] !== TERMINAL) { const a = this.parent[x]!; amount = Math.min(amount, this.capacity[a ^ 1]!); x = this.head[a]!; }
        amount = Math.min(amount, this.terminal[x]!); x = sink;
        while (this.parent[x] !== TERMINAL) { const a = this.parent[x]!; amount = Math.min(amount, this.capacity[a]!); x = this.head[a]!; }
        amount = Math.min(amount, -this.terminal[x]!);
        this.capacity[edge ^ 1] += amount; this.capacity[edge] -= amount;
        x = source;
        while (this.parent[x] !== TERMINAL) {
            const a = this.parent[x]!, up = this.head[a]!;
            this.capacity[a] += amount; this.capacity[a ^ 1] -= amount;
            if (this.capacity[a ^ 1]! <= EPS) { this.parent[x] = ORPHAN; orphans.push(x); }
            x = up;
        }
        this.terminal[x] -= amount;
        if (this.terminal[x]! <= EPS) { this.parent[x] = ORPHAN; orphans.push(x); }
        x = sink;
        while (this.parent[x] !== TERMINAL) {
            const a = this.parent[x]!, up = this.head[a]!;
            this.capacity[a ^ 1] += amount; this.capacity[a] -= amount;
            if (this.capacity[a]! <= EPS) { this.parent[x] = ORPHAN; orphans.push(x); }
            x = up;
        }
        this.terminal[x] += amount;
        if (this.terminal[x]! >= -EPS) { this.parent[x] = ORPHAN; orphans.push(x); }
        this.flow += amount;
    }
    private adopt(i: number, time: number, queue: Queue, orphans: Queue): void {
        const sink = this.sink[i]!;
        let best = NONE, minimum = Infinity;
        for (let a = this.first[i]!; a !== NONE; a = this.next[a]!) {
            const j = this.head[a]!;
            if (this.capacity[sink ? a : a ^ 1]! <= EPS || this.sink[j] !== sink || this.parent[j] === NONE) continue;
            let d = 0, k = j;
            for (;;) {
                if (this.timestamp[k] === time) { d += this.distance[k]!; break; }
                const parent = this.parent[k]!; d++;
                if (parent === TERMINAL) { this.timestamp[k] = time; this.distance[k] = 1; break; }
                if (parent === ORPHAN || parent === NONE) { d = Infinity; break; }
                k = this.head[parent]!;
            }
            if (!Number.isFinite(d)) continue;
            if (d < minimum) { best = a; minimum = d; }
            k = j;
            let remaining = d;
            while (this.timestamp[k] !== time) {
                this.timestamp[k] = time; this.distance[k] = remaining--;
                k = this.head[this.parent[k]!]!;
            }
        }
        if (best !== NONE) { this.parent[i] = best; this.timestamp[i] = time; this.distance[i] = minimum + 1; return; }
        this.parent[i] = NONE;
        for (let a = this.first[i]!; a !== NONE; a = this.next[a]!) {
            const j = this.head[a]!, parent = this.parent[j]!;
            if (this.sink[j] !== sink || parent === NONE) continue;
            if (this.capacity[sink ? a : a ^ 1]! > EPS && !this.active[j]) { this.active[j] = 1; queue.push(j); }
            if (parent !== TERMINAL && parent !== ORPHAN && this.head[parent] === i) { this.parent[j] = ORPHAN; orphans.push(j); }
        }
    }
}
