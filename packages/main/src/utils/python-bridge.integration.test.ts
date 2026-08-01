import { spawnSync } from 'child_process';
import path from 'path';
import { describe, expect, it, vi } from 'vitest';
import { AgentSupervisor } from './AgentSupervisor';

vi.mock('electron', () => ({
    app: {
        isPackaged: false,
    },
}));

vi.mock('electron-log', () => ({
    default: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    },
}));

interface WaterfallReport {
    distributions: Record<string, { split: string; amount: number }>;
    total_distributed: number;
    processed_at: string;
}

const fixture = {
    gross: 1000,
    splits: {
        artist_01: 0.5,
        producer_01: 0.3,
        label_hq: 0.2,
    },
};

function resolvePythonCommand(): string {
    if (process.env.PYTHON_PATH) return process.env.PYTHON_PATH;
    if (process.env.PYTHON_CMD) return process.env.PYTHON_CMD;

    const python3 = spawnSync('python3', ['--version'], { stdio: 'ignore' });
    return python3.status === 0 ? 'python3' : 'python';
}

describe('PythonBridge waterfall subprocess integration', () => {
    it('keeps stdout to one parseable JSON line and diagnostics on stderr', () => {
        const result = spawnSync(
            resolvePythonCommand(),
            [
                path.resolve(process.cwd(), 'execution/finance/waterfall_payout.py'),
                JSON.stringify(fixture),
            ],
            { encoding: 'utf8' },
        );

        expect(result.status).toBe(0);
        expect(result.error).toBeUndefined();
        expect(result.stdout.trimEnd().split('\n')).toHaveLength(1);
        expect(() => JSON.parse(result.stdout)).not.toThrow();
        expect(result.stdout).not.toContain('Calculating waterfall');
        expect(result.stderr).toContain('Calculating waterfall');
    });

    it('preserves the nonzero exit and machine-readable error contract', () => {
        const result = spawnSync(
            resolvePythonCommand(),
            [
                path.resolve(process.cwd(), 'execution/finance/waterfall_payout.py'),
                JSON.stringify({ gross: 1000 }),
            ],
            { encoding: 'utf8' },
        );

        expect(result.status).toBe(1);
        expect(result.stdout.trimEnd().split('\n')).toHaveLength(1);
        expect(JSON.parse(result.stdout)).toEqual({
            error: "Missing 'gross' or 'splits' in input data.",
        });
        expect(result.stderr).toContain("Missing 'gross' or 'splits' in input data.");
    });

    it('returns numeric allocations through the real AgentSupervisor bridge', async () => {
        const onProgress = vi.fn();

        const report = await AgentSupervisor.execute<WaterfallReport>(
            'finance',
            'waterfall_payout.py',
            [JSON.stringify(fixture)],
            { timeoutMs: 10_000 },
            onProgress,
            {},
            [0],
        );

        expect(report.distributions).toEqual({
            artist_01: { split: '50.0%', amount: 425 },
            producer_01: { split: '30.0%', amount: 255 },
            label_hq: { split: '20.0%', amount: 170 },
        });
        expect(report.total_distributed).toBe(850);
        expect(Number.isNaN(Date.parse(report.processed_at))).toBe(false);
        expect(onProgress).not.toHaveBeenCalled();
    });
});
