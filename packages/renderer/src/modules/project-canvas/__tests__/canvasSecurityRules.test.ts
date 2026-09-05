import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const repoCwdPath = resolve(process.cwd(), 'packages/firebase/firestore.rules');
const fallbackPath = resolve(process.cwd(), '../firebase/firestore.rules');
const rulesPath = existsSync(repoCwdPath) ? repoCwdPath : fallbackPath;
const rulesContent = readFileSync(rulesPath, 'utf8');

describe('Project Canvas Firestore Security Rules', () => {
    it('ensures rules file exists and has syntactically balanced braces and parentheses', () => {
        expect(existsSync(rulesPath)).toBe(true);

        let braceCount = 0;
        let parenCount = 0;
        for (const char of rulesContent) {
            if (char === '{') braceCount++;
            if (char === '}') braceCount--;
            if (char === '(') parenCount++;
            if (char === ')') parenCount--;
        }

        expect(braceCount).toBe(0);
        expect(parenCount).toBe(0);
    });

    it('declares rules_version 2 and cloud.firestore service', () => {
        expect(rulesContent).toContain("rules_version = '2';");
        expect(rulesContent).toContain('service cloud.firestore');
    });

    it('defines project-scoped canvas root collection with strict project authorization', () => {
        expect(rulesContent).toContain('match /canvases/{canvasId}');
        expect(rulesContent).toContain('exists(/databases/$(database)/documents/projects/$(projectId))');
        expect(rulesContent).toContain('get(/databases/$(database)/documents/projects/$(projectId)).data.userId == request.auth.uid');
        expect(rulesContent).toContain('isOrgMember(get(/databases/$(database)/documents/projects/$(projectId)).data.orgId)');
        expect(rulesContent).toContain("get(/databases/$(database)/documents/projects/$(projectId)).data.userId == 'founder-demo-uid'");
    });

    it('defines blocks subcollection inheriting project authorization', () => {
        expect(rulesContent).toContain('match /blocks/{blockId}');
        expect(rulesContent).toContain('allow read, write: if exists(/databases/$(database)/documents/projects/$(projectId))');
    });

    it('defines edges subcollection inheriting project authorization', () => {
        expect(rulesContent).toContain('match /edges/{edgeId}');
        expect(rulesContent).toContain('allow read, write: if exists(/databases/$(database)/documents/projects/$(projectId))');
    });

    it('defines presence subcollection with collaborator read and per-user write isolation', () => {
        expect(rulesContent).toContain('match /presence/{presenceUserId}');
        // Collaborators can read presence
        expect(rulesContent).toContain('allow read: if exists(/databases/$(database)/documents/projects/$(projectId))');
        // Only the presence owner can write their own presence
        expect(rulesContent).toContain('request.auth.uid == presenceUserId');
    });

    it('prohibits wild open permissions on canvas paths', () => {
        // Find canvas rules section
        const canvasSectionStart = rulesContent.indexOf('match /canvases/{canvasId}');
        expect(canvasSectionStart).toBeGreaterThan(0);
        const canvasSection = rulesContent.slice(canvasSectionStart, canvasSectionStart + 2500);

        expect(canvasSection).not.toContain('allow read, write: if true;');
        expect(canvasSection).not.toContain('allow write: if true;');
        expect(canvasSection).not.toContain('allow read: if true;');
    });
});
