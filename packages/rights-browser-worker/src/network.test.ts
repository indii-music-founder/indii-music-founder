import { describe, expect, it } from 'vitest';
import { isPublicAddress } from './network.js';

describe('Hosted browser DNS address policy', () => {
    it.each([
        '0.0.0.0', '127.1.0.1', '10.2.3.4', '172.31.255.255', '192.168.1.1',
        '169.254.169.254', '100.127.0.1', '192.0.0.1', '192.0.2.1', '192.88.99.1',
        '198.18.0.1', '198.51.100.1', '203.0.113.1', '224.0.0.1', '::ffff:127.0.0.1',
    ])('denies connections to non-public address %s', address => {
        expect(isPublicAddress(address)).toBe(false);
    });

    it.each(['1.1.1.1', '17.253.144.10', '185.15.58.224'])('allows a public IPv4 address %s', address => {
        expect(isPublicAddress(address)).toBe(true);
    });
});
