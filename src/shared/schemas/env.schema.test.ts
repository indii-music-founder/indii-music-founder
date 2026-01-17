import { describe, it, expect } from 'vitest';
import { CommonEnvSchema } from './env.schema';

describe('CommonEnvSchema', () => {
    it('should validate valid env', () => {
        const data = {
            apiKey: 'key',
            projectId: 'proj',
        };
        const result = CommonEnvSchema.parse(data);
        expect(result.location).toBe('us-central1');
        expect(result.useVertex).toBe(false);
    });

    it('should require apiKey and projectId', () => {
        const data = {
            apiKey: '',
            projectId: ''
        };
        expect(() => CommonEnvSchema.parse(data)).toThrow();
    });
});
