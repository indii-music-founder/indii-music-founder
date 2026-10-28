import React, { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import AgentGrid from './AgentGrid';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion');
  const stripMotion = ({ children, whileInView, initial, animate, exit, transition, viewport, ...props }: any) => props;
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      ...actual.motion,
      article: ({ children, ...props }: any) => <article {...stripMotion(props)}>{children}</article>,
      div: ({ children, ...props }: any) => <div {...stripMotion(props)}>{children}</div>,
    },
  };
});

class IntersectionObserverStub {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds = [];
  constructor(private callback: (entries: Array<{ isIntersecting: boolean; target: Element }>) => void) {}
  observe(target: Element) {
    this.callback([{ isIntersecting: true, target }]);
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

describe('AgentGrid Release Lifecycle Clips (ISSUE-1427)', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeAll(() => {
    window.IntersectionObserver = IntersectionObserverStub as unknown as typeof IntersectionObserver;
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders active lifecycle stage video with synchronized caption track', async () => {
    await act(async () => {
      root.render(<AgentGrid />);
    });

    const video = container.querySelector('video');
    expect(video).toBeTruthy();
    expect(video?.hasAttribute('controls')).toBe(true);
    expect(video?.hasAttribute('playsinline')).toBe(true);
    // Mandatory ISSUE-1427 rule: clips must never autoplay with sound
    expect(video?.hasAttribute('autoplay')).toBe(false);

    const source = video?.querySelector('source');
    expect(source?.getAttribute('src')).toBe('/clips/clip-06-ddex-packaging.mp4');

    const track = video?.querySelector('track');
    expect(track?.getAttribute('src')).toBe('/clips/clip-06-ddex-packaging.vtt');
    expect(track?.getAttribute('kind')).toBe('captions');
    expect(track?.getAttribute('srclang')).toBe('en');
  });

  it('switches video clip and captions when selecting a different lifecycle stage', async () => {
    await act(async () => {
      root.render(<AgentGrid />);
    });

    const registerTab = container.querySelector('#tab-register') as HTMLButtonElement;
    expect(registerTab).toBeTruthy();

    await act(async () => {
      registerTab.click();
      await new Promise((resolve) => setTimeout(resolve, 450));
    });

    const video = container.querySelector('video');
    const source = video?.querySelector('source');
    expect(source?.getAttribute('src')).toBe('/clips/clip-05-rights-copilot.mp4');

    const track = video?.querySelector('track');
    expect(track?.getAttribute('src')).toBe('/clips/clip-05-rights-copilot.vtt');
  });
});
