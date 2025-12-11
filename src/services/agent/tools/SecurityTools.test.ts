import { describe, it, expect } from 'vitest';
import { check_api_status, scan_content, rotate_credentials } from './SecurityTools';

describe('SecurityTools (Mocked)', () => {
    describe('check_api_status', () => {
        it('should return ACTIVE for known active API', async () => {
            const result = await check_api_status({ api_name: 'payment-api' });
            const parsed = JSON.parse(result);
            expect(parsed.api).toBe('payment-api');
            expect(parsed.status).toBe('ACTIVE');
            expect(parsed.environment).toBe('production');
        });

        it('should return DISABLED for known disabled API', async () => {
            const result = await check_api_status({ api_name: 'test-endpoint' });
            const parsed = JSON.parse(result);
            expect(parsed.status).toBe('DISABLED');
        });

        it('should return UNKNOWN for unknown API', async () => {
            const result = await check_api_status({ api_name: 'random-api' });
            const parsed = JSON.parse(result);
            expect(parsed.status).toBe('UNKNOWN');
        });
    });

    describe('scan_content', () => {
        it('should return safe for clean content', async () => {
            const result = await scan_content({ text: 'Hello world, this is a safe message.' });
            const parsed = JSON.parse(result);
            expect(parsed.safe).toBe(true);
            expect(parsed.risk_score).toBe(0.0);
            expect(parsed.flagged_terms).toHaveLength(0);
        });

        it('should flag sensitive terms', async () => {
            const result = await scan_content({ text: 'Here is my secret password.' });
            const parsed = JSON.parse(result);
            expect(parsed.safe).toBe(false);
            expect(parsed.risk_score).toBe(0.9);
            expect(parsed.flagged_terms).toContain('secret');
            expect(parsed.flagged_terms).toContain('password');
            expect(parsed.recommendation).toBe('BLOCK_OR_REDACT');
        });
    });

    describe('rotate_credentials', () => {
        it('should simulate credential rotation', async () => {
            const result = await rotate_credentials({ service_name: 'database-db' });
            const parsed = JSON.parse(result);
            expect(parsed.service).toBe('database-db');
            expect(parsed.action).toBe('rotate_credentials');
            expect(parsed.status).toBe('SUCCESS');
            expect(parsed.new_key_id).toBeDefined();
            expect(parsed.timestamp).toBeDefined();
        });
    });
});
