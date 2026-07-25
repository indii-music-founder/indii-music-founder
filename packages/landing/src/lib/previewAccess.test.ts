import { afterEach, describe, expect, it, vi } from 'vitest';
import { isFounderPreviewEnabled } from './previewAccess';

describe('Founder preview access', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps public preview access closed by default', () => {
    vi.stubEnv('VITE_FOUNDER_PREVIEW_ENABLED', '');

    expect(isFounderPreviewEnabled()).toBe(false);
  });

  it('opens public preview access only when explicitly enabled', () => {
    vi.stubEnv('VITE_FOUNDER_PREVIEW_ENABLED', 'true');

    expect(isFounderPreviewEnabled()).toBe(true);
  });
});
