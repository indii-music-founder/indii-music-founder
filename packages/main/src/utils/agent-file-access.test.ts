import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { replaceUniqueAgentChunks, resolveAuthorizedAgentFile } from './agent-file-access';

describe('agent filesystem boundary (local structural contract)', () => {
    const roots: string[] = [];
    const temporaryRoot = () => {
        const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'agent-file-boundary-')));
        roots.push(root);
        return root;
    };
    afterEach(() => {
        for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
    });

    it('denies a workspace file unless the independent access policy grants it', () => {
        const root = temporaryRoot();
        const granted = path.join(root, 'granted');
        fs.mkdirSync(granted);
        const deniedFile = path.join(root, 'protected.txt');
        const permittedFile = path.join(granted, 'notes.txt');
        fs.writeFileSync(deniedFile, 'unchanged');
        fs.writeFileSync(permittedFile, 'editable');
        const policy = (file: string) => path.dirname(file) === granted;
        expect(() => resolveAuthorizedAgentFile(deniedFile, root, policy)).toThrow('Access denied');
        expect(fs.readFileSync(deniedFile, 'utf8')).toBe('unchanged');
        expect(resolveAuthorizedAgentFile(permittedFile, root, policy)).toBe(permittedFile);
    });

    it('rejects traversal, sibling prefixes, and symlinks escaping the workspace', () => {
        const root = temporaryRoot();
        const outside = temporaryRoot();
        const externalFile = path.join(outside, 'outside.txt');
        fs.writeFileSync(externalFile, 'outside');
        fs.symlinkSync(externalFile, path.join(root, 'escape.txt'), 'file');
        const policy = (file: string) => fs.statSync(file).isFile();
        for (const target of [externalFile, path.relative(root, externalFile), path.join(root, 'escape.txt'), `${root}-sibling/file.txt`]) {
            expect(() => resolveAuthorizedAgentFile(target, root, policy)).toThrow('Invalid file path');
        }
    });

    it('passes a canonical file path to the policy and rejects non-file targets', () => {
        const root = temporaryRoot();
        const target = path.join(root, 'notes.txt');
        fs.writeFileSync(target, 'text');
        fs.symlinkSync(target, path.join(root, 'alias.txt'), 'file');
        expect(resolveAuthorizedAgentFile('alias.txt', root, file => file === target)).toBe(target);
        expect(() => resolveAuthorizedAgentFile('.', root, file => file === root)).toThrow('Invalid file path');
        for (const invalid of [null, 12, '', 'bad\0path']) {
            expect(() => resolveAuthorizedAgentFile(invalid, root, file => file === target)).toThrow('Invalid file path');
        }
    });
});

describe('agent replacement contract', () => {
    it('applies unique chunks and preserves literal replacement syntax', () => {
        expect(replaceUniqueAgentChunks('alpha beta', [
            { targetContent: 'alpha', replacementContent: '$& $` $\'' },
            { targetContent: 'beta', replacementContent: 'omega' },
        ])).toBe('$& $` $\' omega');
    });

    it('rejects empty or ambiguous edits before a caller can write a result', () => {
        for (const chunks of [[], [{ targetContent: '', replacementContent: 'x' }], [{ targetContent: 'text', replacementContent: 1 }]]) {
            expect(() => replaceUniqueAgentChunks('text text', chunks)).toThrow();
        }
        expect(() => replaceUniqueAgentChunks('text text', [{ targetContent: 'text', replacementContent: 'x' }])).toThrow('multiple times');
        expect(() => replaceUniqueAgentChunks('text', [{ targetContent: 'absent', replacementContent: 'x' }])).toThrow('not found');
    });
});
