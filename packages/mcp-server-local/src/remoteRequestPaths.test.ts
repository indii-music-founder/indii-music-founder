import { describe, expect, it } from 'vitest';
import { githubReviewUrls, sentryIssuesUrl } from './remoteRequestPaths.js';

describe('local MCP remote request paths (pure URL contract)', () => {
    const github = { owner: 'team', repo: '.github', pull_number: 12 };
    const sentry = { organization_slug: 'team', project_slug: 'app.prod' };

    it('builds only the named GitHub review and comment endpoints', () => {
        expect(githubReviewUrls(github)).toEqual({
            reviews: 'https://api.github.com/repos/team/.github/pulls/12/reviews',
            comments: 'https://api.github.com/repos/team/.github/pulls/12/comments',
        });
    });

    it('keeps Sentry origin, path and unresolved query under application control', () => {
        const url = new URL(sentryIssuesUrl(sentry));
        expect(url.origin).toBe('https://sentry.io');
        expect(url.pathname).toBe('/api/0/projects/team/app.prod/issues/');
        expect([...url.searchParams.entries()]).toEqual([['query', 'is:unresolved']]);
    });

    it('rejects traversal, encoded separators, query and fragment syntax in every segment', () => {
        for (const value of ['.', '..', '../other', 'a/b', 'a\\b', '%2e%2e', '%252f', 'a?x=1', 'a#fragment', 'a b', 'https://example.com', '', 'x'.repeat(101)]) {
            expect(() => githubReviewUrls({ ...github, owner: value })).toThrow();
            expect(() => githubReviewUrls({ ...github, repo: value })).toThrow();
            expect(() => sentryIssuesUrl({ ...sentry, organization_slug: value })).toThrow();
            expect(() => sentryIssuesUrl({ ...sentry, project_slug: value })).toThrow();
        }
    });

    it('rejects missing/non-string namespaces and non-positive, non-integer PR numbers', () => {
        for (const value of [undefined, null, 1, true, ['team']]) {
            expect(() => githubReviewUrls({ ...github, owner: value })).toThrow();
            expect(() => sentryIssuesUrl({ ...sentry, project_slug: value })).toThrow();
        }
        for (const value of [undefined, '12', 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
            expect(() => githubReviewUrls({ ...github, pull_number: value })).toThrow();
        }
    });
});
