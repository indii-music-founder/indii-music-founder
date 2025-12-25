
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Polyfill for Web Crypto API if needed (usually available in newer Node, but safe is better)
const subtle = crypto.webcrypto ? crypto.webcrypto.subtle : null;

async function verifyFingerprintHash() {
    console.log("🔍 Verifying Sonic Fingerprint Hashing...");

    const filePath = path.join(process.cwd(), 'sample-6s.mp3');

    if (!fs.existsSync(filePath)) {
        console.error("❌ Error: sample-6s.mp3 not found. Did the download fail?");
        return;
    }

    try {
        const fileBuffer = fs.readFileSync(filePath);

        // 1. Generate Data Hash (SHA-256) simulating the Browser API used in FingerprintService
        // In browser: await crypto.subtle.digest('SHA-256', arrayBuffer);

        let hashHex;
        if (subtle) {
            const hashBuffer = await subtle.digest('SHA-256', fileBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } else {
            // Fallback to Node crypto if webcrypto is tricky in this specific test env
            hashHex = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        }

        const shortHash = hashHex.substring(0, 16);
        console.log(`✅ File Read Success: ${fileBuffer.length} bytes`);
        console.log(`✅ SHA-256 Hash Generated: ${hashHex}`);
        console.log(`🔹 Sonic ID Prefix (Layer 1): SONIC-${shortHash}-...`);
        console.log("\n(Note: Layer 2 [BPM/Key] requires the Electron App environment with Essentia.js)");

    } catch (err) {
        console.error("❌ Hashing Validation Failed:", err);
    }
}

verifyFingerprintHash();
