import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const mocks = vi.hoisted(() => ({
    handle: vi.fn(),
    validateSender: vi.fn(),
    verifyAccess: vi.fn(),
    saveCredentials: vi.fn(),
}));

vi.mock('electron', () => ({
    ipcMain: { handle: mocks.handle },
}));

vi.mock('electron-log', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('../utils/ipc-security', () => ({
    validateSender: mocks.validateSender,
}));

vi.mock('../security/AccessControlService', () => ({
    accessControlService: {
        verifyAccess: mocks.verifyAccess,
    },
}));

vi.mock('../services/CredentialService', () => ({
    credentialService: {
        saveCredentials: mocks.saveCredentials,
    },
}));

vi.mock('libsodium-wrappers', () => ({
    default: {
        ready: Promise.resolve(),
        base64_variants: { ORIGINAL: 1 },
        from_base64: vi.fn(() => new Uint8Array([1, 2, 3])),
        from_string: vi.fn(() => new Uint8Array([4, 5, 6])),
        crypto_box_seal: vi.fn(() => new Uint8Array([7, 8, 9])),
        to_base64: vi.fn(() => 'encrypted-base64'),
    },
}));

import { registerSecurityHandlers } from './security';

function collectFiles(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectFiles(fullPath));
        } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
            files.push(fullPath);
        }
    }
    return files;
}

describe('ISSUE-1558 & ISSUE-1564: IPC allowlist parity & GitHub credential rotation path safety', () => {
    describe('KNOWN_IPC_CHANNELS parity (ISSUE-1558)', () => {
        it('includes every registered ipcMain.handle and ipcMain.on channel across packages/main/src', () => {
            const mainRoot = path.resolve(__dirname, '..');
            const mainTs = fs.readFileSync(path.join(mainRoot, 'main.ts'), 'utf8');
            const allowlistMatch = mainTs.match(/const KNOWN_IPC_CHANNELS = new Set\(\[([\s\S]*?)\]\);/);
            expect(allowlistMatch).not.toBeNull();

            const knownChannels = new Set(
                [...allowlistMatch![1].matchAll(/'([^']+)'/g)].map(match => match[1])
            );

            const registeredChannels = new Set<string>();
            for (const file of collectFiles(mainRoot)) {
                const source = fs.readFileSync(file, 'utf8');
                for (const match of source.matchAll(/ipcMain\.(?:handle|on)\(\s*'([^']+)'/g)) {
                    registeredChannels.add(match[1]);
                }
                for (const match of source.matchAll(/inputHandler\(\s*'([^']+)'/g)) {
                    registeredChannels.add(match[1]);
                }
            }

            const missingFromAllowlist = [...registeredChannels].filter(ch => !knownChannels.has(ch));
            expect(missingFromAllowlist).toEqual([]);
            expect(knownChannels.has('computer:click')).toBe(true);
            expect(knownChannels.has('computer:key')).toBe(true);
            expect(knownChannels.has('computer:scroll')).toBe(true);
        });
    });

    describe('security:rotate-credentials GitHub path validation (ISSUE-1564)', () => {
        let handlers: Map<string, (...args: unknown[]) => Promise<{ success: boolean; error?: string }>>;
        let fetchSpy: ReturnType<typeof vi.spyOn>;

        beforeEach(() => {
            vi.clearAllMocks();
            handlers = new Map();
            mocks.handle.mockImplementation((channel: string, handler: (...args: unknown[]) => Promise<{ success: boolean; error?: string }>) => {
                handlers.set(channel, handler);
            });
            fetchSpy = vi.spyOn(globalThis, 'fetch');
            registerSecurityHandlers();
        });

        it('rejects malformed or path-traversing GitHub repo strings before calling fetch', async () => {
            const rotate = handlers.get('security:rotate-credentials')!;
            for (const badRepo of [
                '../victim',
                'owner/..',
                'owner/repo/extra',
                'owner/repo/../other',
                'owner/repo?admin=true',
                'owner/',
                '/repo',
            ]) {
                const res = await rotate({}, {
                    serviceName: 'github',
                    vaultData: {
                        github_token: 'ghp_test_token',
                        repo: badRepo,
                        secret_name: 'DEPLOY_KEY',
                        secret_value: 'super-secret',
                    },
                });
                expect(res.success).toBe(false);
                expect(res.error).toMatch(/Invalid GitHub repository/);
            }
            expect(fetchSpy).not.toHaveBeenCalled();
        });

        it('rejects path-traversing or invalid GitHub secret_name strings before calling fetch', async () => {
            const rotate = handlers.get('security:rotate-credentials')!;
            for (const badSecretName of [
                '../other-endpoint',
                'SECRET/NAME',
                '123_STARTS_WITH_DIGIT',
                'SECRET-WITH-DASH',
                'SECRET?query=1',
            ]) {
                const res = await rotate({}, {
                    serviceName: 'github',
                    vaultData: {
                        github_token: 'ghp_test_token',
                        repo: 'indii-org/indii-repo',
                        secret_name: badSecretName,
                        secret_value: 'super-secret',
                    },
                });
                expect(res.success).toBe(false);
                expect(res.error).toMatch(/Invalid GitHub Actions secret_name/);
            }
            expect(fetchSpy).not.toHaveBeenCalled();
        });
    });
});
