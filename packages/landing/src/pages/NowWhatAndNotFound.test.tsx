import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { INDII_BRAND } from '@shared/brand';
import NowWhatShareRedirect from './NowWhatShareRedirect';
import NotFound from './NotFound';

vi.mock('../lib/auth', () => ({
  getStudioUrl: () => 'https://app.indii.music',
}));

describe('NowWhatShareRedirect & NotFound', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('redirects a valid /n/:hook to the Artist Passport with UTM attribution', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/n/already-released']}>
          <Routes>
            <Route path="/n/:hook" element={<NowWhatShareRedirect />} />
            <Route path="/passport" element={<div data-testid="passport-target">Passport</div>} />
          </Routes>
        </MemoryRouter>,
      );
    });

    expect(container.querySelector('[data-testid="passport-target"]')).not.toBeNull();
  });

  it('redirects an unknown /n/:hook back to /#now-what', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/n/does-not-exist']}>
          <Routes>
            <Route path="/n/:hook" element={<NowWhatShareRedirect />} />
            <Route path="/" element={<div data-testid="home-target">Home</div>} />
          </Routes>
        </MemoryRouter>,
      );
    });

    expect(container.querySelector('[data-testid="home-target"]')).not.toBeNull();
  });

  it('renders the branded Now what? 404 page with canonical tagline and 3 escape links', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/missing-route']}>
          <Routes>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </MemoryRouter>,
      );
    });

    expect(container.textContent).toContain('This track hasn’t dropped yet.');
    expect(container.textContent).toContain('Now what?');
    expect(container.textContent).toContain(INDII_BRAND.tagline);
    expect(container.querySelector('a[href="/"]')).not.toBeNull();
    expect(container.querySelector('a[href="/passport?source=404_recovery"]')).not.toBeNull();
    expect(container.querySelector('a[href="https://app.indii.music"]')).not.toBeNull();
  });
});
