import { FirestoreService } from './packages/renderer/src/services/FirestoreService';
import { db } from './packages/renderer/src/services/firebase'; // Ensure it compiles or we mock better.

// To truly simulate the N+1 issue, let's write a mock that penalizes high concurrency
let activeConnections = 0;
const MAX_CONCURRENT = 100;

async function mockDeleteWithLimit(id: string) {
    activeConnections++;
    if (activeConnections > MAX_CONCURRENT) {
        // Penalty for exceeding connection pool
        await new Promise(r => setTimeout(r, 100));
    } else {
        await new Promise(r => setTimeout(r, 10));
    }
    activeConnections--;
}

async function mockDeleteMany(ids: string[]) {
    // 1 connection per batch
    activeConnections++;
    await new Promise(r => setTimeout(r, 20)); // slightly larger payload
    activeConnections--;
}

async function runBenchmark() {
    console.log("Setting up benchmark test with 1000 memories (simulating connection limits)...");
    const NUM_MEMORIES = 1000;
    const memories = Array.from({length: NUM_MEMORIES}).map((_, i) => ({ id: `id-${i}` }));
    const ids = memories.map(m => m.id);

    activeConnections = 0;
    console.time("Baseline (N+1)");
    await Promise.all(memories.map((m) => mockDeleteWithLimit(m.id)));
    console.timeEnd("Baseline (N+1)");

    activeConnections = 0;
    console.time("Optimized (Batch)");
    for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500);
        await mockDeleteMany(chunk);
    }
    console.timeEnd("Optimized (Batch)");
}

runBenchmark().catch(console.error);
