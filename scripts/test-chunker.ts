
import { smartChunk } from '../src/utils/textChunker';

function runTest() {
    console.log("Testing Smart Chunking...");

    const text = `Paragraph 1. Sentence 1. Sentence 2.

Paragraph 2 is longer. It has more sentences. This is sentence 3 of paragraph 2.

Paragraph 3 is short.`;

    // Test 1: Small chunk size (should split paragraphs)
    console.log("\nTest 1: Small chunk size (50 chars)");
    const chunks1 = smartChunk(text, 50);
    chunks1.forEach((c, i) => console.log(`[Chunk ${i}]: ${c.replace(/\n/g, '\\n')}`));

    if (chunks1.length > 1) console.log("✅ Split correctly");
    else console.error("❌ Failed to split");

    // Test 2: Large chunk size (should keep together)
    console.log("\nTest 2: Large chunk size (500 chars)");
    const chunks2 = smartChunk(text, 500);
    console.log(`Chunks count: ${chunks2.length}`);
    if (chunks2.length === 1) console.log("✅ Kept together correctly");
    else console.error("❌ Failed to keep together");

    // Test 3: Sentence splitting
    const longPara = "S1. " + "Word ".repeat(20) + ". S2. " + "Word ".repeat(20) + ".";
    console.log("\nTest 3: Sentence splitting");
    const chunks3 = smartChunk(longPara, 100); // Should split S1 and S2
    chunks3.forEach((c, i) => console.log(`[Chunk ${i}]: ${c}`));
    if (chunks3.length > 1) console.log("✅ Split sentences correctly");
}

runTest();
