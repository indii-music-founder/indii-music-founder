import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { AIProviderMonitor } from './AIProviderMonitor';

describe('AIProviderMonitor', () => {
  beforeEach(() => {
    localStorage.setItem('indii_admin_token', 'admin-test-token');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('states clearly when no provider is participating in app traffic', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      windowDays: 30,
      totalCalls: 0,
      successfulCalls: 0,
      successRate: 0,
      averageLatencyMs: 0,
      estimatedCostUsd: 0,
      providers: [],
      recentEvents: [],
    }), { status: 200, headers: { 'content-type': 'application/json' } })));

    render(<AIProviderMonitor />);

    await waitFor(() => {
      expect(screen.getByText('No application provider calls recorded')).toBeTruthy();
    });
    expect(screen.getByText(/TypeSafe is not currently participating/)).toBeTruthy();
  });
});
