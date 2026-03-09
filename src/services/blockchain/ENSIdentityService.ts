/**
 * ENSIdentityService — Item 240
 *
 * Allows artists to resolve and claim .eth (ENS) or .nft (Unstoppable Domains)
 * as their on-chain identity. Displayed in profile and EPK.
 *
 * ENS resolution uses eth_call directly to the ENS public resolver via JSON-RPC.
 * Unstoppable Domains uses their Resolution API.
 *
 * Env:
 *   VITE_ETH_RPC_URL   — Ethereum JSON-RPC endpoint (Alchemy/Infura/public)
 *   VITE_UD_API_KEY    — Unstoppable Domains Resolution API key
 */

import { db } from '@/services/firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

export interface DomainIdentity {
    domain: string;           // e.g. "artistname.eth" or "artistname.nft"
    type: 'ens' | 'unstoppable';
    walletAddress: string;    // Resolved Ethereum address
    avatar?: string;          // Avatar URL (ENS text record or UD profile)
    twitter?: string;         // Social handle from domain records
    resolvedAt: string;       // ISO timestamp
}

// ENS Public Resolver on Ethereum mainnet
const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';
// ENS namehash precomputed for well-known names (used for resolver lookup)
// namehash is always computed on-chain; we use eth_call to do it

const DEFAULT_RPC = 'https://cloudflare-eth.com'; // Public Cloudflare ETH gateway
const UD_API = 'https://resolve.unstoppabledomains.com';

export class ENSIdentityService {
    private rpcUrl: string;
    private udApiKey: string;

    constructor() {
        this.rpcUrl = import.meta.env.VITE_ETH_RPC_URL || DEFAULT_RPC;
        this.udApiKey = import.meta.env.VITE_UD_API_KEY || '';
    }

    /**
     * Resolve a .eth or .nft domain to a wallet address and metadata.
     * Auto-detects domain type from TLD.
     */
    async resolve(domain: string): Promise<DomainIdentity> {
        const normalized = domain.toLowerCase().trim();

        if (normalized.endsWith('.eth')) {
            return this.resolveENS(normalized);
        } else if (normalized.endsWith('.nft') || normalized.endsWith('.crypto') || normalized.endsWith('.wallet')) {
            return this.resolveUnstoppable(normalized);
        } else {
            throw new Error(`Unsupported domain type: ${domain}. Use .eth, .nft, .crypto, or .wallet`);
        }
    }

    /**
     * Resolve ENS domain via Ethereum JSON-RPC (no ethers.js needed).
     * Uses the ENS Universal Resolver contract.
     */
    async resolveENS(domain: string): Promise<DomainIdentity> {
        // Step 1: Compute the namehash using the ENS registry
        // ENS namehash: keccak256(keccak256(parent) ++ keccak256(label)) recursively
        // We call the ENS Public Resolver via eth_call
        const namehash = this.computeNamehash(domain);

        // Step 2: Get resolver address from ENS registry (0x3b3... resolver function)
        // ENS Registry: resolver(bytes32 node) returns (address)
        const resolverAddr = await this.ethCall(ENS_REGISTRY, 'resolver(bytes32)', [namehash]);
        if (!resolverAddr || resolverAddr === '0x' + '0'.repeat(64)) {
            throw new Error(`No ENS resolver found for ${domain}`);
        }

        // Extract address from 32-byte padded response
        const resolverAddress = '0x' + resolverAddr.slice(-40);

        // Step 3: Call addr(bytes32) on the resolver
        const addrResult = await this.ethCall(resolverAddress, 'addr(bytes32)', [namehash]);
        if (!addrResult || addrResult === '0x' + '0'.repeat(64)) {
            throw new Error(`ENS domain ${domain} has no address record`);
        }
        const walletAddress = '0x' + addrResult.slice(-40);

        // Step 4: Try to fetch avatar text record (best-effort)
        let avatar: string | undefined;
        try {
            const avatarResult = await this.ethCall(resolverAddress, 'text(bytes32,string)', [namehash, 'avatar']);
            if (avatarResult && avatarResult !== '0x') {
                avatar = this.decodeString(avatarResult);
            }
        } catch { /* avatar is optional */ }

        // Step 5: Try to fetch twitter text record
        let twitter: string | undefined;
        try {
            const twitterResult = await this.ethCall(resolverAddress, 'text(bytes32,string)', [namehash, 'com.twitter']);
            if (twitterResult && twitterResult !== '0x') {
                twitter = this.decodeString(twitterResult);
            }
        } catch { /* twitter is optional */ }

        return {
            domain,
            type: 'ens',
            walletAddress,
            avatar,
            twitter,
            resolvedAt: new Date().toISOString(),
        };
    }

    /**
     * Resolve Unstoppable Domains (.nft, .crypto, .wallet) via Resolution API.
     */
    async resolveUnstoppable(domain: string): Promise<DomainIdentity> {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (this.udApiKey) {
            headers['Authorization'] = `Bearer ${this.udApiKey}`;
        }

        const res = await fetch(`${UD_API}/domains/${encodeURIComponent(domain)}`, { headers });

        if (res.status === 404) {
            throw new Error(`Unstoppable Domain ${domain} not found or not registered`);
        }
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Unstoppable Domains resolution failed (${res.status}): ${err}`);
        }

        const data = await res.json() as {
            records: Record<string, string>;
            meta: { owner: string; domain: string };
        };

        const walletAddress = data.meta.owner ||
            data.records['crypto.ETH.address'] ||
            data.records['crypto.MATIC.address'] || '';

        if (!walletAddress) {
            throw new Error(`No wallet address found for ${domain}`);
        }

        return {
            domain,
            type: 'unstoppable',
            walletAddress,
            avatar: data.records['social.picture.value'],
            twitter: data.records['social.twitter.username'],
            resolvedAt: new Date().toISOString(),
        };
    }

    /**
     * Save verified domain identity to artist profile in Firestore.
     * The domain becomes the artist's on-chain identity shown in EPK.
     */
    async claimDomain(uid: string, identity: DomainIdentity): Promise<void> {
        await setDoc(
            doc(db, 'users', uid, 'onChainIdentity', identity.type),
            {
                ...identity,
                claimedAt: serverTimestamp(),
                uid,
            },
            { merge: true }
        );

        // Also save to the user's top-level profile for quick access
        await setDoc(
            doc(db, 'users', uid),
            {
                onChainDomain: identity.domain,
                onChainDomainType: identity.type,
                onChainWallet: identity.walletAddress,
            },
            { merge: true }
        );
    }

    /**
     * Get the artist's currently claimed domain identity.
     */
    async getClaimedIdentity(uid: string): Promise<DomainIdentity | null> {
        for (const type of ['ens', 'unstoppable'] as const) {
            const snap = await getDoc(doc(db, 'users', uid, 'onChainIdentity', type));
            if (snap.exists()) {
                return snap.data() as DomainIdentity;
            }
        }
        return null;
    }

    // ─── JSON-RPC Helpers ─────────────────────────────────────────────────

    private async ethCall(to: string, _signature: string, _params: string[]): Promise<string> {
        // Encode the function call as ABI calldata
        const calldata = this.encodeCall(_signature, _params);

        const body = {
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_call',
            params: [{ to, data: calldata }, 'latest'],
        };

        const res = await fetch(this.rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const json = await res.json() as { result?: string; error?: { message: string } };
        if (json.error) throw new Error(`eth_call error: ${json.error.message}`);
        return json.result || '0x';
    }

    /**
     * Minimal ABI encoder for simple function calls (bytes32 args, string args).
     * Handles: resolver(bytes32), addr(bytes32), text(bytes32, string)
     */
    private encodeCall(signature: string, params: string[]): string {
        // 4-byte function selector (first 4 bytes of keccak256 of signature)
        const selector = this.keccak256Selector(signature);
        let data = selector;

        // Encode each param
        const argTypes = signature.slice(signature.indexOf('(') + 1, signature.lastIndexOf(')')).split(',').map(s => s.trim());
        let offset = argTypes.length * 32; // offset for dynamic types
        const staticParts: string[] = [];
        const dynamicParts: string[] = [];

        for (let i = 0; i < argTypes.length; i++) {
            const type = argTypes[i];
            const param = params[i];

            if (type === 'bytes32') {
                // bytes32: pad to 32 bytes
                staticParts.push(param.replace('0x', '').padStart(64, '0'));
            } else if (type === 'string') {
                // string: dynamic — static slot holds offset
                staticParts.push(offset.toString(16).padStart(64, '0'));
                const encoded = this.encodeString(param);
                dynamicParts.push(encoded);
                offset += encoded.length / 2;
            } else if (type === 'address') {
                staticParts.push(param.replace('0x', '').padStart(64, '0'));
            }
        }

        data += staticParts.join('') + dynamicParts.join('');
        return data;
    }

    private encodeString(str: string): string {
        const bytes = new TextEncoder().encode(str);
        const lenHex = bytes.length.toString(16).padStart(64, '0');
        let bytesHex = '';
        for (const b of bytes) bytesHex += b.toString(16).padStart(2, '0');
        // Pad to 32-byte boundary
        const padLen = 64 - (bytesHex.length % 64);
        if (padLen < 64) bytesHex += '0'.repeat(padLen);
        return lenHex + bytesHex;
    }

    private decodeString(hex: string): string {
        // ABI-encoded string: [offset][length][data...]
        // For direct text() calls, result starts with offset at 0x20
        try {
            const clean = hex.replace('0x', '');
            // Skip offset (first 64 chars = 32 bytes)
            const lenHex = clean.slice(64, 128);
            const len = parseInt(lenHex, 16);
            const dataHex = clean.slice(128, 128 + len * 2);
            const bytes = new Uint8Array(dataHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
            return new TextDecoder().decode(bytes);
        } catch {
            return '';
        }
    }

    /**
     * Compute ENS namehash for a domain name.
     * namehash('') = 0x000...000
     * namehash('eth') = keccak256(namehash('') ++ keccak256('eth'))
     * namehash('vitalik.eth') = keccak256(namehash('eth') ++ keccak256('vitalik'))
     *
     * Uses the Web Crypto API (available in browsers and Node.js 22).
     */
    private computeNamehash(name: string): string {
        // We can't run async crypto in a sync method easily, so we use a known approach:
        // Return a placeholder that triggers a proper RPC call via eth_call to the registry.
        // In practice, for a production build, use viem's namehash or import it via CDN.
        // Here we use a pure JS implementation.
        const EMPTY_HASH = new Uint8Array(32);
        const labels = name.split('.').reverse();
        let node = EMPTY_HASH;

        for (const label of labels) {
            const labelBytes = new TextEncoder().encode(label);
            const labelHash = this.keccak256Bytes(labelBytes);
            const combined = new Uint8Array(64);
            combined.set(node, 0);
            combined.set(labelHash, 32);
            node = this.keccak256Bytes(combined);
        }

        return '0x' + Array.from(node).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Minimal synchronous Keccak-256 implementation.
     * Uses the tiny-keccak algorithm (Ethereum standard hash).
     * NOTE: This is a basic implementation for namehash — NOT for security-critical signing.
     */
    private keccak256Bytes(data: Uint8Array): Uint8Array {
        // Keccak-256 state constants
        const RC: bigint[] = [
            0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
            0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
            0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
            0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
            0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
            0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
        ];
        const ROTC = [1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14, 27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44];
        const PIL = [10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4, 15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1];
        const M5 = [0, 1, 2, 3, 4, 0, 1, 2, 3, 4];

        const rate = 136; // Keccak-256: rate = 1088 bits = 136 bytes
        const capacity = 64;
        const hashLen = 32;

        // Pad message
        const padded = new Uint8Array(Math.ceil((data.length + 1) / rate) * rate || rate);
        padded.set(data);
        padded[data.length] = 0x01;
        padded[padded.length - 1] |= 0x80;

        // State: 5×5 64-bit lanes as BigInt
        const state: bigint[] = new Array(25).fill(0n);
        const view = new DataView(padded.buffer);

        for (let offset = 0; offset < padded.length; offset += rate) {
            for (let i = 0; i < rate / 8; i++) {
                const lo = BigInt(view.getUint32(offset + i * 8, true));
                const hi = BigInt(view.getUint32(offset + i * 8 + 4, true));
                state[i] ^= (hi << 32n) | lo;
            }

            // Keccak-f[1600]
            for (let r = 0; r < 24; r++) {
                // θ (theta)
                const C = state.slice(0, 5).map((_, i) => state[i] ^ state[i + 5] ^ state[i + 10] ^ state[i + 15] ^ state[i + 20]);
                const D = C.map((_, i) => C[M5[i + 4]] ^ this.rotl64(C[M5[i + 1]], 1n));
                for (let i = 0; i < 25; i++) state[i] ^= D[i % 5];

                // ρ (rho) + π (pi)
                const B: bigint[] = new Array(25).fill(0n);
                for (let i = 1; i < 25; i++) {
                    B[PIL[i - 1]] = this.rotl64(state[i], BigInt(ROTC[i - 1]));
                }
                B[0] = state[0];

                // χ (chi)
                for (let i = 0; i < 25; i++) {
                    state[i] = B[i] ^ (~B[M5[i % 5 + 1] + Math.floor(i / 5) * 5] & B[M5[i % 5 + 2] + Math.floor(i / 5) * 5]);
                }

                // ι (iota)
                state[0] ^= RC[r];
            }
        }

        // Extract hash
        const hash = new Uint8Array(hashLen);
        const hashView = new DataView(hash.buffer);
        for (let i = 0; i < hashLen / 8; i++) {
            const lane = state[i];
            hashView.setUint32(i * 8, Number(lane & 0xFFFFFFFFn), true);
            hashView.setUint32(i * 8 + 4, Number((lane >> 32n) & 0xFFFFFFFFn), true);
        }
        return hash;
    }

    private rotl64(x: bigint, n: bigint): bigint {
        const mask = 0xFFFFFFFFFFFFFFFFn;
        return ((x << n) | (x >> (64n - n))) & mask;
    }

    private keccak256Selector(signature: string): string {
        const bytes = new TextEncoder().encode(signature);
        const hash = this.keccak256Bytes(bytes);
        return '0x' + Array.from(hash.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
}

export const ensIdentityService = new ENSIdentityService();
