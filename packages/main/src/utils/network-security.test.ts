import { describe, it, expect } from 'vitest';
import { isPrivateIP, expandIPv6 } from './network-security';

describe('network-security utils', () => {
    describe('isPrivateIP', () => {
        describe('IPv4', () => {
            it('should block 0.0.0.0/8 (Current network)', () => {
                expect(isPrivateIP('0.0.0.0')).toBe(true);
                expect(isPrivateIP('0.255.255.255')).toBe(true);
            });

            it('should block 127.0.0.0/8 (Loopback)', () => {
                expect(isPrivateIP('127.0.0.1')).toBe(true);
                expect(isPrivateIP('127.255.255.255')).toBe(true);
            });

            it('should block 10.0.0.0/8 (Private)', () => {
                expect(isPrivateIP('10.0.0.0')).toBe(true);
                expect(isPrivateIP('10.255.255.255')).toBe(true);
            });

            it('should block 172.16.0.0/12 (Private)', () => {
                expect(isPrivateIP('172.16.0.0')).toBe(true);
                expect(isPrivateIP('172.31.255.255')).toBe(true);
                // Edge cases around the 16-31 range
                expect(isPrivateIP('172.15.255.255')).toBe(false);
                expect(isPrivateIP('172.32.0.0')).toBe(false);
            });

            it('should block 192.168.0.0/16 (Private)', () => {
                expect(isPrivateIP('192.168.0.0')).toBe(true);
                expect(isPrivateIP('192.168.255.255')).toBe(true);
                expect(isPrivateIP('192.167.255.255')).toBe(false);
            });

            it('should block 169.254.0.0/16 (Link-Local)', () => {
                expect(isPrivateIP('169.254.0.0')).toBe(true);
                expect(isPrivateIP('169.254.255.255')).toBe(true);
                expect(isPrivateIP('169.253.255.255')).toBe(false);
            });

            it('should block 100.64.0.0/10 (Carrier Grade NAT)', () => {
                expect(isPrivateIP('100.64.0.0')).toBe(true);
                expect(isPrivateIP('100.127.255.255')).toBe(true);
                expect(isPrivateIP('100.63.255.255')).toBe(false);
                expect(isPrivateIP('100.128.0.0')).toBe(false);
            });

            it('should block 192.0.0.0/24 (IETF Protocol Assignments)', () => {
                expect(isPrivateIP('192.0.0.0')).toBe(true);
                expect(isPrivateIP('192.0.0.255')).toBe(true);
                expect(isPrivateIP('192.0.1.0')).toBe(false);
            });

            it('should block 192.0.2.0/24 (TEST-NET-1)', () => {
                expect(isPrivateIP('192.0.2.0')).toBe(true);
                expect(isPrivateIP('192.0.2.255')).toBe(true);
                expect(isPrivateIP('192.0.3.0')).toBe(false);
            });

            it('should block 198.18.0.0/15 (Benchmarking)', () => {
                expect(isPrivateIP('198.18.0.0')).toBe(true);
                expect(isPrivateIP('198.19.255.255')).toBe(true);
                expect(isPrivateIP('198.17.255.255')).toBe(false);
                expect(isPrivateIP('198.20.0.0')).toBe(false);
            });

            it('should block 198.51.100.0/24 (TEST-NET-2)', () => {
                expect(isPrivateIP('198.51.100.0')).toBe(true);
                expect(isPrivateIP('198.51.100.255')).toBe(true);
                expect(isPrivateIP('198.51.101.0')).toBe(false);
            });

            it('should block 203.0.113.0/24 (TEST-NET-3)', () => {
                expect(isPrivateIP('203.0.113.0')).toBe(true);
                expect(isPrivateIP('203.0.113.255')).toBe(true);
                expect(isPrivateIP('203.0.114.0')).toBe(false);
            });

            it('should block 224.0.0.0/4 (Multicast and above)', () => {
                expect(isPrivateIP('224.0.0.0')).toBe(true);
                expect(isPrivateIP('239.255.255.255')).toBe(true);
                expect(isPrivateIP('255.255.255.255')).toBe(true);
                expect(isPrivateIP('223.255.255.255')).toBe(false);
            });

            it('should allow valid public IPs', () => {
                expect(isPrivateIP('8.8.8.8')).toBe(false);
                expect(isPrivateIP('1.1.1.1')).toBe(false);
                expect(isPrivateIP('142.250.190.46')).toBe(false); // Google
            });

            it('should return false for invalid IPv4', () => {
                 expect(isPrivateIP('256.256.256.256')).toBe(false); // Valid string but invalid IP, handled by net.isIP
                 expect(isPrivateIP('192.168.1')).toBe(false);
            });
        });

        describe('IPv6', () => {
            it('should block ::1 (Loopback)', () => {
                expect(isPrivateIP('::1')).toBe(true);
                expect(isPrivateIP('0000:0000:0000:0000:0000:0000:0000:0001')).toBe(true);
            });

            it('should block :: (Unspecified)', () => {
                expect(isPrivateIP('::')).toBe(true);
                expect(isPrivateIP('0000:0000:0000:0000:0000:0000:0000:0000')).toBe(true);
            });

            it('should block fc00::/7 (Unique Local)', () => {
                expect(isPrivateIP('fc00::')).toBe(true);
                expect(isPrivateIP('fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff')).toBe(true);
            });

            it('should block fe80::/10 (Link-Local)', () => {
                expect(isPrivateIP('fe80::')).toBe(true);
                expect(isPrivateIP('febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff')).toBe(true);
                expect(isPrivateIP('fe7f::')).toBe(false);
                expect(isPrivateIP('fec0::')).toBe(false);
            });

            it('should block ff00::/8 (Multicast)', () => {
                expect(isPrivateIP('ff00::')).toBe(true);
                expect(isPrivateIP('ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff')).toBe(true);
            });

            it('should block IPv4-Mapped IPs pointing to private IPv4', () => {
                // ::ffff:192.168.1.1
                expect(isPrivateIP('::ffff:192.168.1.1')).toBe(true);
                expect(isPrivateIP('::ffff:c0a8:0101')).toBe(true); // Same as 192.168.1.1 in hex
                // Public mapped
                expect(isPrivateIP('::ffff:8.8.8.8')).toBe(false);
                expect(isPrivateIP('::ffff:0808:0808')).toBe(false);
            });

             it('should block IPv4-Compatible IPs pointing to private IPv4', () => {
                // ::192.168.1.1
                expect(isPrivateIP('::192.168.1.1')).toBe(true);
                expect(isPrivateIP('::c0a8:0101')).toBe(true); // Same as 192.168.1.1 in hex
                 // Public compatible
                expect(isPrivateIP('::8.8.8.8')).toBe(false);
                expect(isPrivateIP('::0808:0808')).toBe(false);
            });

            it('should allow valid public IPv6', () => {
                expect(isPrivateIP('2001:4860:4860::8888')).toBe(false); // Google DNS
                expect(isPrivateIP('2606:4700:4700::1111')).toBe(false); // Cloudflare DNS
            });

            it('should return false for invalid IPv6', () => {
                 expect(isPrivateIP('2001:4860:4860:::8888')).toBe(false);
            });
        });

        describe('Invalid Inputs', () => {
            it('should return false for non-IP strings', () => {
                expect(isPrivateIP('localhost')).toBe(false);
                expect(isPrivateIP('example.com')).toBe(false);
                expect(isPrivateIP('')).toBe(false);
                expect(isPrivateIP('not an ip')).toBe(false);
            });
        });
    });

    describe('expandIPv6', () => {
        it('should expand short IPv6 addresses correctly', () => {
             expect(expandIPv6('::1')).toBe('0000:0000:0000:0000:0000:0000:0000:0001');
             expect(expandIPv6('2001:db8::1')).toBe('2001:0db8:0000:0000:0000:0000:0000:0001');
        });

        it('should expand embedded IPv4 addresses correctly', () => {
            expect(expandIPv6('::ffff:192.168.1.1')).toBe('0000:0000:0000:0000:0000:ffff:c0a8:0101');
            expect(expandIPv6('::192.168.1.1')).toBe('0000:0000:0000:0000:0000:0000:c0a8:0101');
        });
    });
});
