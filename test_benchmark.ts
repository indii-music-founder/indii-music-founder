const mockDelete = async (id: string) => {
    // simulate a small delay for network
    await new Promise(r => setTimeout(r, 10));
};

const mockDeleteMany = async (ids: string[]) => {
    // simulate a small delay for batch network
    await new Promise(r => setTimeout(r, 10));
};

async function benchmark() {
    const NUM_MEMORIES = 2000;
    const memories = Array.from({length: NUM_MEMORIES}).map((_, i) => ({ id: `id-${i}` }));
    const ids = memories.map(m => m.id);

    console.time("Promise.all(map(delete))");
    await Promise.all(memories.map((m) => mockDelete(m.id)));
    console.timeEnd("Promise.all(map(delete))");

    console.time("deleteMany");
    // This is how deleteMany works: chunks of 500
    for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500);
        await mockDeleteMany(chunk);
    }
    console.timeEnd("deleteMany");
}

benchmark().catch(console.error);
