/**
 * ISSUE-1124: Waterfall payout IPC integration test
 * Tests the real ipcMain.handle('distribution:execute-waterfall') closure
 * with real AgentSupervisor/PythonBridge/python3 subprocess.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import path from 'path';

// Resolve repo root relative to this test file (packages/main/src/handlers/ → repo root)
process.env.ROOT_DIR = process.env.ROOT_DIR || path.resolve(__dirname, '../../../..');

// Mock minimal Electron internals
const mockHandlers: Record<string, (event: unknown, data: unknown) => Promise<unknown>> = {};
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: (_name: string) => '/tmp',
    getAppPath: () => process.cwd(),
  },
  ipcMain: {
    handle: (channel: string, handler: (event: unknown, data: unknown) => Promise<unknown>) => {
      mockHandlers[channel] = handler;
    },
  },
}));

// Import the handler registration
import { setupDistributionHandlers } from './distribution';

describe('ISSUE-1124: Waterfall Payout IPC Integration', () => {
  beforeAll(async () => {
    // Register handlers
    setupDistributionHandlers();
  });

  it('processes valid $1000/50-30-20 split through real Python subprocess', async () => {
    const handler = mockHandlers['distribution:execute-waterfall'];
    expect(handler).toBeDefined();

    const fakeEvent = {
      senderFrame: { url: 'http://localhost:4243/index.html' },
      sender: { send: vi.fn(), isDestroyed: () => false },
    };

    const result = await handler(fakeEvent, {
      gross: 1000,
      splits: {
        artist_01: 0.5,
        producer_01: 0.3,
        label_hq: 0.2,
      },
    }) as Record<string, unknown>;

    expect(result).toBeDefined();
    expect((result as any).success).toBe(true);
    expect((result as any).report).toBeDefined();
    expect((result as any).report.total_distributed).toBe(850);
    expect((result as any).report.distributions).toBeDefined();
    expect((result as any).report.distributions.artist_01.amount).toBe(425);
    expect((result as any).report.distributions.producer_01.amount).toBe(255);
    expect((result as any).report.distributions.label_hq.amount).toBe(170);
  });

  it('rejects missing splits with 409 error', async () => {
    const handler = mockHandlers['distribution:execute-waterfall'];

    const fakeEvent = {
      senderFrame: { url: 'http://localhost:4243/index.html' },
      sender: { send: vi.fn(), isDestroyed: () => false },
    };

    const result = await handler(fakeEvent, {
      gross: 1000,
      splits: {}, // Empty splits
    }) as Record<string, unknown>;

    expect((result as any).success).toBe(false);
    expect((result as any).error).toBeDefined();
  });
});
