/**
 * Item 240: ENS / Unstoppable Domains Resolution Service
 *
 * Provides blockchain name resolution for ENS (.eth domains)
 * and Unstoppable Domains (.crypto, .nft, .wallet, etc.).
 * Uses the Ethereum RPC via Alchemy — no separate API key needed.
 *
 * @mock The `computeNamehash()` implementation is a PLACEHOLDER — it does NOT
 *       perform real EIP-137 keccak256 hashing. Production requires ethers.js
 *       `namehash()` or equivalent. Entire Web3 module gated behind `enable_web3`.
 *
 * ENS: https://docs.ens.domains/
 * Unstoppable: https://docs.unstoppabledomains.com/
 */

import { ethereumService } from './EthereumService';
import { logger } from '@/utils/logger';

/** ENS Registry contract address (Ethereum mainnet) */
const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';
/** Unstoppable Domains resolver proxy */
const UD_PROXY = '0xa9a6A3626993D487d2Dbda3173cf58cA1a9D9e9f';

export interface ResolvedName {
    name: string;
    address: string | null;
    avatar?: string;
    provider: 'ens' | 'unstoppable';
}

export class NameResolutionService {
    /**
     * Resolve an ENS name to an Ethereum address.
     * Uses the ENS public resolver.
     */
    async resolveENS(name: string): Promise<string | null> {
        if (!ethereumService.isConfigured()) {
            logger.warn('[ENS] Alchemy not configured, cannot resolve');
            return null;
        }

        try {
            // namehash computation for ENS
            const namehash = this.computeNamehash(name);

            // Call ENS registry: resolver(bytes32 node)
            const resolverSelector = '0x0178b8bf'; // resolver(bytes32)
            const resolverData = resolverSelector + namehash.slice(2);
            const resolverAddress = await ethereumService.callContract(ENS_REGISTRY, resolverData, 1);

            if (!resolverAddress || resolverAddress === '0x' + '0'.repeat(64)) {
                return null;
            }

            // Extract resolver address (last 40 chars)
            const resolver = '0x' + resolverAddress.slice(-40);

            // Call resolver: addr(bytes32 node)
            const addrSelector = '0x3b3b57de'; // addr(bytes32)
            const addrData = addrSelector + namehash.slice(2);
            const result = await ethereumService.callContract(resolver, addrData, 1);

            if (!result || result === '0x' + '0'.repeat(64)) {
                return null;
            }

            return '0x' + result.slice(-40);
        } catch (err) {
            logger.error('[ENS] Resolution failed:', err);
            return null;
        }
    }

    /**
     * Resolve an Unstoppable Domains name.
     * Calls the UNS proxy resolver on Polygon.
     */
    async resolveUnstoppable(name: string): Promise<string | null> {
        if (!ethereumService.isConfigured()) {
            logger.warn('[UD] Alchemy not configured');
            return null;
        }

        try {
            // Unstoppable uses a different namehash but similar pattern
            const namehash = this.computeUDNamehash(name);

            // Call proxy: getMany(string[] keys, uint256 tokenId)
            // For simplicity, use the resolve endpoint directly
            const selector = '0xb85afd28'; // getMany(string[],uint256)
            const data = selector + namehash.slice(2);
            const result = await ethereumService.callContract(UD_PROXY, data, 137);

            if (!result || result === '0x') {
                return null;
            }

            return '0x' + result.slice(-40);
        } catch (err) {
            logger.error('[UD] Resolution failed:', err);
            return null;
        }
    }

    /**
     * Resolve any blockchain domain name.
     * Automatically detects ENS (.eth) vs Unstoppable (.crypto, .nft, etc.).
     */
    async resolve(name: string): Promise<ResolvedName> {
        const normalized = name.toLowerCase().trim();

        if (normalized.endsWith('.eth')) {
            const address = await this.resolveENS(normalized);
            return { name: normalized, address, provider: 'ens' };
        }

        const udExtensions = ['.crypto', '.nft', '.wallet', '.blockchain', '.bitcoin', '.dao', '.888', '.x', '.zil'];
        const isUD = udExtensions.some(ext => normalized.endsWith(ext));

        if (isUD) {
            const address = await this.resolveUnstoppable(normalized);
            return { name: normalized, address, provider: 'unstoppable' };
        }

        // Default: try ENS first, then Unstoppable
        const ensAddress = await this.resolveENS(normalized);
        if (ensAddress) {
            return { name: normalized, address: ensAddress, provider: 'ens' };
        }

        const udAddress = await this.resolveUnstoppable(normalized);
        return { name: normalized, address: udAddress, provider: 'unstoppable' };
    }

    /**
     * Compute ENS namehash (EIP-137).
     * node = keccak256(node(parent) + keccak256(label))
     */
    private computeNamehash(name: string): string {
        // Simplified namehash — in production use ethers.js namehash()
        const labels = name.split('.').reverse();
        let node = '0x' + '0'.repeat(64); // bytes32(0)

        for (const _label of labels) {
            // Each iteration would keccak256(node + keccak256(label))
            // Placeholder: return a deterministic hash for the name
            node = '0x' + Array.from(new TextEncoder().encode(_label + node))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('')
                .padEnd(64, '0')
                .slice(0, 64);
        }

        return node;
    }

    /**
     * Compute Unstoppable Domains namehash.
     */
    private computeUDNamehash(name: string): string {
        // Similar to ENS but uses different algorithm
        return this.computeNamehash(name);
    }
}

export const nameResolutionService = new NameResolutionService();
