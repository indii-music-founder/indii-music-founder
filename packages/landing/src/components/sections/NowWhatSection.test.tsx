import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import NowWhatSection from './NowWhatSection';

describe('NowWhatSection', () => {
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
    vi.restoreAllMocks();
  });

  it('renders the kinetic stage, all 6 Now what? cards, and keeps Passport entry URLs', async () => {
    await act(async () => {
      root.render(<NowWhatSection />);
    });

    expect(container.textContent).toContain('You finished your first song.');
    expect(container.textContent).toContain('Now what?');

    const links = Array.from(container.querySelectorAll('a[href^="/passport?entry="]'));
    expect(links.length).toBeGreaterThanOrEqual(6);
    expect(links.some((a) => a.getAttribute('href') === '/passport?entry=already-released&source=now_what_homepage')).toBe(true);
    expect(container.querySelectorAll('video').length).toBe(6);
    expect(container.querySelectorAll('track[kind="captions"]').length).toBe(6);
  });

  it('switches the featured stage on stepper click and copies /n/:hook on Share click', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    await act(async () => {
      root.render(<NowWhatSection />);
    });

    const step4 = container.querySelector('button[aria-label*="People are listening."]') as HTMLButtonElement;
    expect(step4).toBeTruthy();
    await act(async () => {
      step4.click();
    });
    expect(container.textContent).toContain('People are listening.');

    const shareBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Share this situation'),
    ) as HTMLButtonElement;
    expect(shareBtn).toBeTruthy();
    await act(async () => {
      shareBtn.click();
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toMatch(/\/n\/growing-audience$/);
    expect(container.querySelector('[role="status"]')?.textContent).toContain('People are listening.');
  });

  it('provides a Pause/Play toggle without aria-pressed', async () => {
    await act(async () => {
      root.render(<NowWhatSection />);
    });

    const pauseBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Pause') as HTMLButtonElement;
    expect(pauseBtn).toBeTruthy();
    expect(pauseBtn.hasAttribute('aria-pressed')).toBe(false);

    await act(async () => {
      pauseBtn.click();
    });
    const playBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Play');
    expect(playBtn).toBeTruthy();
  });
});
