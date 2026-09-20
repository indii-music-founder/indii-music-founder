import { describe, expect, it } from 'vitest';
import { projectToMetadata } from './projectTypeUtils';

describe('projectToMetadata', () => {
    it('preserves the project organization boundary for downstream operations', () => {
        const metadata = projectToMetadata({
            id: 'project-1',
            name: 'Project 1',
            type: 'creative',
            orgId: 'personal',
        });

        expect(metadata.orgId).toBe('personal');
    });
});
