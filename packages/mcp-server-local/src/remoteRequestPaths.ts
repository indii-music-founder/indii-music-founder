import { z } from 'zod';

// Opaque bounded path segments; query/fragment/encoding syntax is never input.
const segment = z.string().min(1).max(100).regex(/^[A-Za-z0-9_.-]+$/)
    .refine(value => value !== '.' && value !== '..');
const githubInput = z.object({ owner: segment, repo: segment, pull_number: z.number().int().positive().safe() });
const sentryInput = z.object({ organization_slug: segment, project_slug: segment });

export function githubReviewUrls(input: unknown): { reviews: string; comments: string } {
    const { owner, repo, pull_number: number } = githubInput.parse(input);
    const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${number}`;
    return { reviews: `${base}/reviews`, comments: `${base}/comments` };
}

export function sentryIssuesUrl(input: unknown): string {
    const { organization_slug: organization, project_slug: project } = sentryInput.parse(input);
    const url = new URL(`https://sentry.io/api/0/projects/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/issues/`);
    url.searchParams.set('query', 'is:unresolved');
    return url.toString();
}
