import { describe, it, expect } from 'vitest';
import {
    DEFAULT_PROJECT_ID,
    LEGACY_DEFAULT_PROJECT_ID,
    isDefaultProject,
    projectBucketMatches,
} from './constants';

// ISSUE-772 / ISSUE-758: the codebase historically wrote two different
// "no project" sentinels. These helpers make both eras one bucket.
describe('project sentinel helpers', () => {
    describe('isDefaultProject', () => {
        it('treats both sentinel values and empty ids as the default bucket', () => {
            expect(isDefaultProject(DEFAULT_PROJECT_ID)).toBe(true);
            expect(isDefaultProject(LEGACY_DEFAULT_PROJECT_ID)).toBe(true);
            expect(isDefaultProject(null)).toBe(true);
            expect(isDefaultProject(undefined)).toBe(true);
            expect(isDefaultProject('')).toBe(true);
        });

        it('treats real project ids as non-default', () => {
            expect(isDefaultProject('proj-abc123')).toBe(false);
        });
    });

    describe('projectBucketMatches', () => {
        it('matches legacy-stamped items when viewing the default bucket', () => {
            expect(projectBucketMatches(LEGACY_DEFAULT_PROJECT_ID, DEFAULT_PROJECT_ID)).toBe(true);
            expect(projectBucketMatches(DEFAULT_PROJECT_ID, LEGACY_DEFAULT_PROJECT_ID)).toBe(true);
            expect(projectBucketMatches(undefined, DEFAULT_PROJECT_ID)).toBe(true);
        });

        it('does not leak real-project items into the default bucket', () => {
            expect(projectBucketMatches('proj-abc123', DEFAULT_PROJECT_ID)).toBe(false);
        });

        it('does not leak default-bucket items into a real project view', () => {
            expect(projectBucketMatches(DEFAULT_PROJECT_ID, 'proj-abc123')).toBe(false);
            expect(projectBucketMatches(LEGACY_DEFAULT_PROJECT_ID, 'proj-abc123')).toBe(false);
        });

        it('requires exact match between real project ids', () => {
            expect(projectBucketMatches('proj-abc123', 'proj-abc123')).toBe(true);
            expect(projectBucketMatches('proj-abc123', 'proj-other')).toBe(false);
        });
    });
});
