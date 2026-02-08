import { describe, it, expect } from 'vitest';

describe('Environment Diagnostic', () => {
    it('should log all relevant environment indicators', () => {
        console.log('--- ENV DIAGNOSTIC ---');
        console.log('import.meta.env.MODE:', import.meta.env.MODE);
        console.log('process.env.VITEST:', process.env.VITEST);
        console.log('process.env.NODE_ENV:', process.env.NODE_ENV);
        console.log('process.env.VITEST_WORKER_ID:', process.env.VITEST_WORKER_ID);
        console.log('----------------------');
        expect(true).toBe(true);
    });
});
