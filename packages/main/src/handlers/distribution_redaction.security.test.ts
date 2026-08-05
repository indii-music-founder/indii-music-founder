import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupDistributionHandlers } from './distribution';

// Hoisted mocks to control behavior
const mocks = vi.hoisted(() => ({
    ipcMain: { handle: vi.fn() },
    agentSupervisor: {
        execute: vi.fn(),
        runScript: vi.fn()
    },
    accessControlService: { verifyAccess: vi.fn(() => true) },
    validateSender: vi.fn(),
    fs: {
        rm: vi.fn(),
        mkdir: vi.fn(),
        writeFile: vi.fn(),
        copyFile: vi.fn()
    },
    fsDefault: {
        rm: vi.fn(),
        mkdir: vi.fn(),
        writeFile: vi.fn(),
        copyFile: vi.fn(),
        realpathSync: vi.fn((p: string) => p),
    },
    os: { tmpdir: vi.fn(() => '/mock/tmp') },
    credentialService: { getCredentials: vi.fn(() => null), saveCredentials: vi.fn(), deleteCredentials: vi.fn() },
    stageCanonicalMasters: vi.fn(),
    stageCanonicalCoverArt: vi.fn(),
}));

// Mock modules — must cover ALL imports in distribution.ts
vi.mock('electron', () => ({
    ipcMain: mocks.ipcMain,
    app: { getPath: () => '/mock/userData', getAppPath: () => '/app' }
}));

vi.mock('../utils/python-bridge', () => ({
    PythonBridge: { runScript: vi.fn() }
}));

vi.mock('../utils/AgentSupervisor', () => ({
    AgentSupervisor: mocks.agentSupervisor
}));

vi.mock('../utils/ipc-security', () => ({
    validateSender: mocks.validateSender
}));

vi.mock('../security/AccessControlService', () => ({
    accessControlService: mocks.accessControlService
}));

vi.mock('../utils/security-checks', () => ({
    validateSafeDistributionSource: vi.fn()
}));

vi.mock('../utils/file-security', () => ({
    validateSafeAudioPath: vi.fn((p: string) => p)
}));

vi.mock('../utils/network-security', () => ({
    validateSafeHostAsync: vi.fn(),
    validateSafeUrlAsync: vi.fn(),
    validateSafeUrl: vi.fn()
}));

vi.mock('../utils/validation', () => ({
    DistributionStageReleaseSchema: { parse: vi.fn((d: unknown) => d) }
}));

vi.mock('../services/CredentialService', () => ({
    credentialService: mocks.credentialService
}));

vi.mock('../services/MasterAudioStagingService', () => ({
    stageCanonicalMasters: mocks.stageCanonicalMasters,
}));

vi.mock('../services/CanonicalCoverArtStagingService', () => ({
    stageCanonicalCoverArt: mocks.stageCanonicalCoverArt,
}));

vi.mock('fs/promises', () => mocks.fs);
vi.mock('fs', () => ({ default: mocks.fsDefault }));
vi.mock('os', () => mocks.os);


describe('🛡️ Shield: Distribution PII Redaction', () => {
    let handlers: Record<string, (...args: unknown[]) => unknown> = {};

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'warn').mockImplementation(() => { });
        vi.spyOn(console, 'info').mockImplementation(() => { });
        handlers = {};
        mocks.ipcMain.handle.mockImplementation((channel: string, handler: (...args: unknown[]) => unknown) => {
            handlers[channel] = handler;
        });
        setupDistributionHandlers();
    });

    const invoke = async (channel: string, ...args: unknown[]) => {
        const handler = handlers[channel];
        if (!handler) throw new Error(`No handler for ${channel}`);
        return handler({ senderFrame: { url: 'file:///app/index.html' }, sender: { send: vi.fn(), isDestroyed: () => false } }, ...args);
    };

    it('should redact sensitive metadata in generate-content-id-csv', async () => {
        const sensitiveData = { title: 'Secret Song', isrc: 'US12345' };
        mocks.agentSupervisor.execute.mockResolvedValue('success');

        await invoke('distribution:generate-content-id-csv', sensitiveData);

        // AgentSupervisor.execute is called with sensitiveArgsIndices as 7th argument
        expect(mocks.agentSupervisor.execute).toHaveBeenCalledWith(
            'distribution',
            'content_id_csv_generator.py',
            expect.arrayContaining([JSON.stringify(sensitiveData), '--storage-path', expect.any(String)]),
            expect.any(Object),  // options { timeoutMs }
            undefined,           // onProgress
            expect.anything(),   // env
            [0]                  // sensitiveArgsIndices — redact the first argument (data)
        );
    });

    it('should redact sensitive metadata in generate-ddex', async () => {
        const sensitiveData = { title: 'Secret Album' };
        mocks.agentSupervisor.execute.mockResolvedValue({ status: 'SUCCESS', xml: '<ddex/>' });

        await invoke('distribution:generate-ddex', sensitiveData);

        expect(mocks.agentSupervisor.execute).toHaveBeenCalledWith(
            'distribution',
            'ingestion_generator.py',
            expect.arrayContaining([JSON.stringify(sensitiveData)]),
            expect.any(Object),
            undefined,
            expect.anything(),
            [0]
        );
    });

    it('should require full XSD validation and return the validator report', async () => {
        const report = {
            valid: true,
            mode: 'xsd',
            errors: [],
            warnings: [],
            summary: 'XSD validation passed'
        };
        mocks.agentSupervisor.execute.mockResolvedValue(report);

        const result = await invoke('distribution:validate-xsd', '<NewReleaseMessage />');

        expect(mocks.agentSupervisor.execute).toHaveBeenCalledWith(
            'distribution',
            'xsd_validator.py',
            [expect.stringMatching(/xsd-validation-.*\.xml$/), '--require-xsd'],
            expect.any(Object)
        );
        expect(result).toEqual({ success: true, report });
    });

    it('should redact sensitive data in generate-bwarm', async () => {
        const sensitiveData = { composer: 'John Doe' };
        mocks.agentSupervisor.execute.mockResolvedValue({ status: 'SUCCESS' });

        await invoke('distribution:generate-bwarm', sensitiveData);

        expect(mocks.agentSupervisor.execute).toHaveBeenCalledWith(
            'distribution',
            'keys_manager.py',
            expect.arrayContaining(['bwarm', JSON.stringify(sensitiveData)]),
            expect.any(Object),
            undefined,
            expect.anything(),
            [1]
        );
    });

    it('should redact sensitive metadata in check-merlin-status', async () => {
        const sensitiveData = {
            catalog_id: 'CAT-user123',
            tracks: [
                { isrc: 'US123', title: 'Song 1', rights_holder: 'Artist', exclusive_rights: true },
                { isrc: 'US124', title: 'Song 2', rights_holder: 'Artist', exclusive_rights: false }
            ]
        };
        mocks.agentSupervisor.execute.mockResolvedValue({ status: 'SUCCESS' });

        await invoke('distribution:check-merlin-status', sensitiveData);

        // ISSUE-1122: check-merlin-status aggregates tracks to fail-closed shape
        const expectedAggregatedData = {
            total_tracks: 2,
            has_isrcs: true,
            has_upcs: false,
            exclusive_rights: false // false because not ALL tracks have exclusive_rights=true
        };

        expect(mocks.agentSupervisor.execute).toHaveBeenCalledWith(
            'distribution',
            'keys_manager.py',
            expect.arrayContaining(['merlin_check', JSON.stringify(expectedAggregatedData)]),
            expect.any(Object),
            undefined,
            expect.anything(),
            [1]
        );
    });

    it('should redact sensitive metadata in register-release', async () => {
        const sensitiveData = { isrc: 'US123' };
        mocks.agentSupervisor.execute.mockResolvedValue({ status: 'SUCCESS' });

        await invoke('distribution:register-release', sensitiveData, 'release-123');

        expect(mocks.agentSupervisor.execute).toHaveBeenCalledWith(
            'distribution',
            'isrc_manager.py',
            expect.arrayContaining(['register', JSON.stringify(sensitiveData)]),
            expect.any(Object),
            undefined,
            expect.anything(),
            [1]
        );
    });

    it('stages canonical master bytes, passes only the verified local path to Python, and cleans up', async () => {
        const cleanup = vi.fn();
        const stagedRelease = {
            title: 'Verified Master Release',
            tracks: [{
                title: 'Signal Path',
                filename: 'resources/01-master.flac',
                master_asset: {
                    content_hash: 'a'.repeat(64),
                    local_path: '/mock/tmp/indii-ddex-master/01-master.flac',
                    storage_path: `masters/user-1/${'a'.repeat(64)}/original.flac`,
                },
            }],
        };
        mocks.stageCanonicalMasters.mockResolvedValue({
            cleanup,
            releaseData: stagedRelease,
            stagingPath: '/mock/tmp/indii-ddex-master',
        });
        const cleanupCover = vi.fn();
        mocks.stageCanonicalCoverArt.mockResolvedValue({
            cleanup: cleanupCover,
            coverAsset: {
                content_hash: 'b'.repeat(64),
                local_path: '/mock/tmp/indii-ddex-cover/cover.jpg',
                mime_type: 'image/jpeg',
                original_file_name: 'cover.jpg',
                size_bytes: 4096,
                storage_path: `covers/user-1/${'b'.repeat(64)}/original.jpg`,
                width: 3000,
                height: 3000,
            },
        });
        mocks.agentSupervisor.execute.mockResolvedValue({ status: 'SUCCESS' });

        await invoke('distribution:submit-release', { title: 'Verified Master Release', tracks: [] });

        expect(mocks.stageCanonicalMasters).toHaveBeenCalledOnce();
        const executeArgs = mocks.agentSupervisor.execute.mock.calls[0]!;
        const childPayload = JSON.parse(executeArgs[2][0]);
        expect(childPayload.tracks[0].master_asset.local_path).toContain('indii-ddex-master');
        expect(childPayload.tracks[0].master_asset.download_url).toBeUndefined();
        expect(childPayload.cover_asset.local_path).toContain('indii-ddex-cover');
        expect(childPayload.cover_asset.download_url).toBeUndefined();
        expect(cleanup).toHaveBeenCalledOnce();
        expect(cleanupCover).toHaveBeenCalledOnce();
    });
});
