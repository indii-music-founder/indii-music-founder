import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const mockDocSet = vi.fn().mockResolvedValue(undefined);
const mockDocGet = vi.fn().mockResolvedValue({ exists: false, data: () => ({}) });
const mockDocRef = {
    set: mockDocSet,
    get: mockDocGet,
};
const mockCollection = vi.fn(() => ({
    doc: vi.fn(() => mockDocRef),
}));
const mockRunTransaction = vi.fn(async (cb: (txn: any) => Promise<any>) => {
    return cb({
        get: mockDocGet,
        set: mockDocSet,
    });
});
const mockGetFiles = vi.fn().mockResolvedValue([
    [
        {
            metadata: {
                timeCreated: new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString(),
                size: '1048576',
            },
        },
    ],
]);
const mockBucket = vi.fn(() => ({
    getFiles: mockGetFiles,
}));

vi.mock('firebase-admin', () => ({
    firestore: Object.assign(vi.fn(() => ({
        collection: mockCollection,
        runTransaction: mockRunTransaction,
    })), {
        FieldValue: {
            serverTimestamp: () => 'SERVER_TIMESTAMP',
        },
    }),
    storage: vi.fn(() => ({
        bucket: mockBucket,
    })),
}));

import {
    scrubOrphanedMediaOp,
    runChaosMeshTestsOp,
    configureCircuitBreakerOp,
    configureWebSocketKeepaliveOp,
    runContentionTestOp,
    configureSentryCrashReportingOp,
    triggerWatchdogRecoveryOp,
    configureLogicalShardingOp,
    provisionQASandboxOp,
} from './devopsOperations';

function getExportedNames(content: string): Set<string> {
    const exports = new Set<string>();
    for (const m of content.matchAll(/export\s+const\s+([A-Za-z0-9_]+)/g)) {
        exports.add(m[1]);
    }
    for (const m of content.matchAll(/export\s*\{([\s\S]*?)\}/g)) {
        for (const part of m[1].split(',')) {
            const trimmed = part.trim();
            if (!trimmed) continue;
            const asMatch = trimmed.match(/([A-Za-z0-9_]+)\s+as\s+([A-Za-z0-9_]+)/);
            if (asMatch) {
                exports.add(asMatch[2]);
            } else {
                const idMatch = trimmed.match(/^[A-Za-z0-9_]+/);
                if (idMatch) exports.add(idMatch[0]);
            }
        }
    }
    return exports;
}

describe('ISSUE-1557: Agent Tools httpsCallable Parity Contract & Operation Verification', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const toolsDir = path.resolve(__dirname, '../../../renderer/src/services/agent/tools');
    const indexFile = path.resolve(__dirname, '../index.ts');

    it('every httpsCallable in agent tools has a corresponding export in packages/firebase/src/index.ts', () => {
        const indexContent = fs.readFileSync(indexFile, 'utf8');
        const exported = getExportedNames(indexContent);
        const toolFiles = fs.readdirSync(toolsDir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));
        
        const referencedCallables = new Set<string>();
        for (const file of toolFiles) {
            const content = fs.readFileSync(path.join(toolsDir, file), 'utf8');
            const matches = content.matchAll(/httpsCallable(?:<[^>]*>)?\s*\(\s*(?:functions|functionsWest1)\s*,\s*['"]([^'"]+)['"]/g);
            for (const m of matches) {
                referencedCallables.add(m[1]);
            }
        }

        const missingExports: string[] = [];
        for (const callableName of Array.from(referencedCallables).sort()) {
            if (!exported.has(callableName)) {
                missingExports.push(callableName);
            }
        }

        expect(missingExports).toEqual([]);
        expect(exported.has('runChaosMeshTests')).toBe(true);
        expect(exported.has('configureCircuitBreaker')).toBe(true);
        expect(exported.has('configureWebSocketKeepalive')).toBe(true);
        expect(exported.has('runContentionTest')).toBe(true);
        expect(exported.has('configureSentryCrashReporting')).toBe(true);
        expect(exported.has('triggerWatchdogRecovery')).toBe(true);
        expect(exported.has('configureLogicalSharding')).toBe(true);
        expect(exported.has('provisionQASandbox')).toBe(true);
        expect(exported.has('scrubOrphanedMedia')).toBe(true);
    });

    it('scrubOrphanedMediaOp processes auditable prefixes and records audit doc', async () => {
        const res = await scrubOrphanedMediaOp({
            olderThanDays: 30,
            bucketId: 'indii-music-test.appspot.com',
            userId: 'admin-1',
        });
        expect(res.status).toBe('completed');
        expect(res.deletedFiles).toBeGreaterThanOrEqual(1);
        expect(res.savedBytes).toBeGreaterThanOrEqual(1048576);
        expect(mockCollection).toHaveBeenCalledWith('admin_storage_scrubs');
    });

    it('scrubOrphanedMediaOp rejects invalid bucketId or olderThanDays', async () => {
        await expect(scrubOrphanedMediaOp({
            olderThanDays: -1,
            bucketId: 'valid-bucket',
            userId: 'admin-1',
        })).rejects.toThrow('Invalid olderThanDays');

        await expect(scrubOrphanedMediaOp({
            olderThanDays: 10,
            bucketId: '../../../etc/passwd',
            userId: 'admin-1',
        })).rejects.toThrow('Invalid bucketId');
    });

    it('runChaosMeshTestsOp executes resilience test and saves test doc', async () => {
        const res = await runChaosMeshTestsOp({
            targetService: 'video_transcoder',
            duration: '30s',
            userId: 'admin-1',
        });
        expect(res.status).toBe('completed');
        expect(res.testId).toMatch(/^chaos_/);
        expect(res.results.targetService).toBe('video_transcoder');
        expect(mockCollection).toHaveBeenCalledWith('devops_chaos_tests');
    });

    it('runChaosMeshTestsOp rejects invalid service names or durations', async () => {
        await expect(runChaosMeshTestsOp({
            targetService: 'bad service with spaces!',
            duration: '30s',
            userId: 'admin-1',
        })).rejects.toThrow('Invalid targetService');

        await expect(runChaosMeshTestsOp({
            targetService: 'valid_service',
            duration: '30lightyears',
            userId: 'admin-1',
        })).rejects.toThrow('Invalid duration');
    });

    it('configureCircuitBreakerOp saves valid configuration', async () => {
        const res = await configureCircuitBreakerOp({
            serviceName: 'stripe_api',
            threshold: 50,
            fallbackBehavior: 'queue_locally',
            userId: 'admin-1',
        });
        expect(res.status).toBe('configured');
        expect(res.configId).toBe('cb_stripe_api');
        expect(mockCollection).toHaveBeenCalledWith('devops_configs');
    });

    it('configureWebSocketKeepaliveOp configures safe ping intervals', async () => {
        const res = await configureWebSocketKeepaliveOp({
            serviceId: 'timeline_sync',
            pingInterval: 30,
            userId: 'admin-1',
        });
        expect(res.status).toBe('applied');
        expect(res.configApplied).toBe(true);

        await expect(configureWebSocketKeepaliveOp({
            serviceId: 'timeline_sync',
            pingInterval: 1, // too low
            userId: 'admin-1',
        })).rejects.toThrow('Invalid pingInterval');
    });

    it('runContentionTestOp executes atomic transaction probe', async () => {
        const res = await runContentionTestOp({
            database: 'default',
            parallelWrites: 10,
            userId: 'admin-1',
        });
        expect(res.status).toBe('passed');
        expect(res.deadlocksDetected).toBe(false);
        expect(res.lockFailures).toBe(0);
        expect(mockRunTransaction).toHaveBeenCalled();
    });

    it('configureSentryCrashReportingOp provides environment reporting config', async () => {
        const res = await configureSentryCrashReportingOp({
            environment: 'production',
            userId: 'admin-1',
        });
        expect(res.status).toBe('active');
        expect(res.dsn).toContain('sentry.io');
    });

    it('triggerWatchdogRecoveryOp generates new execution context', async () => {
        const res = await triggerWatchdogRecoveryOp({
            agentId: 'publishing_agent',
            loopThreshold: 5,
            userId: 'admin-1',
        });
        expect(res.status).toBe('recovered');
        expect(res.newContextId).toMatch(/^ctx_/);
        expect(mockCollection).toHaveBeenCalledWith('agent_watchdog_recoveries');
    });

    it('configureLogicalShardingOp generates safe deterministic shard partition keys', async () => {
        const res = await configureLogicalShardingOp({
            collection: 'analytics_events',
            shards: 4,
            userId: 'admin-1',
        });
        expect(res.status).toBe('sharded');
        expect(res.shardKeys).toEqual([
            'analytics_events_shard_0',
            'analytics_events_shard_1',
            'analytics_events_shard_2',
            'analytics_events_shard_3',
        ]);
    });

    it('provisionQASandboxOp sets 24-hour expiration on sandbox url', async () => {
        const res = await provisionQASandboxOp({
            environmentName: 'feat-release-v2',
            snapshotId: 'snap_20261107',
            userId: 'admin-1',
        });
        expect(res.status).toBe('provisioned');
        expect(res.url).toBe('https://feat-release-v2-sandbox.indii.music');
        expect(new Date(res.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });
});
