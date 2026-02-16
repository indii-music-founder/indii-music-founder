import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { createTool, zodToToolParameters } from './ZodUtils';

describe('ZodUtils', () => {
    describe('zodToToolParameters', () => {
        it('should convert a simple object schema', () => {
            const schema = z.object({
                name: z.string().describe('The name property'),
                age: z.number().int().describe('The age property')
            });

            const params = zodToToolParameters(schema);

            expect(params.type).toBe('OBJECT');
            expect(params.required).toContain('name');
            expect(params.required).toContain('age');
            expect(params.properties['name'].type).toBe('STRING');
            expect(params.properties['name'].description).toBe('The name property');
            expect(params.properties['age'].type).toBe('INTEGER');
        });

        it('should handle nested objects', () => {
            const schema = z.object({
                user: z.object({
                    id: z.string(),
                    settings: z.object({
                        enabled: z.boolean()
                    })
                })
            });

            const params = zodToToolParameters(schema);
            expect(params.properties['user']?.type).toBe('OBJECT');
            expect(params.properties['user']?.properties?.['settings']?.type).toBe('OBJECT');
            expect(params.properties['user']?.properties?.['settings']?.properties?.['enabled']?.type).toBe('BOOLEAN');
        });

        it('should handle arrays', () => {
            const schema = z.object({
                tags: z.array(z.string()).describe('List of tags')
            });

            const params = zodToToolParameters(schema);
            expect(params.properties['tags']?.type).toBe('ARRAY');
            expect(params.properties['tags']?.items?.type).toBe('STRING');
        });

        it('should handle enums', () => {
            const schema = z.object({
                role: z.enum(['admin', 'user'])
            });

            const params = zodToToolParameters(schema);
            expect(params.properties['role']?.type).toBe('STRING');
            expect(params.properties['role']?.enum).toEqual(['admin', 'user']);
        });
    });

    describe('createTool', () => {
        it('should create a FunctionDeclaration with schema', () => {
            const schema = z.object({ query: z.string() });
            const tool = createTool('search', 'Search tool', schema);

            expect(tool.name).toBe('search');
            expect(tool.description).toBe('Search tool');
            expect(tool.schema).toBe(schema);
            expect(tool.parameters.properties['query']?.type).toBe('STRING');
        });
    });
});
