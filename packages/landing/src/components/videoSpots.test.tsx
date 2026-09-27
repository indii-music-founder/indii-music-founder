import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import Hero from './sections/Hero';
import AppStudioShowcase from './AppStudioShowcase';
import OverlookedWorkSection from './sections/OverlookedWorkSection';
import ExperienceShell from './ExperienceShell';

describe('Landing Page Video Spots Integration', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

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

  it('renders ambient studio loop in ExperienceShell', async () => {
    await act(async () => {
      root.render(<ExperienceShell />);
    });

    const video = container.querySelector('video');
    expect(video).toBeTruthy();
    expect(video?.getAttribute('src')).toBe('/videos/ambient-studio-loop.mp4');
    expect(video?.hasAttribute('autoplay')).toBe(true);
    expect(video?.hasAttribute('loop')).toBe(true);
    expect(video?.muted).toBe(true);
  });

  it('renders video slicing demo in OverlookedWorkSection', async () => {
    await act(async () => {
      root.render(<OverlookedWorkSection />);
    });

    const video = container.querySelector('video');
    expect(video).toBeTruthy();
    expect(video?.getAttribute('src')).toBe('/videos/video-slicing-demo.mp4');
    expect(container.textContent).toContain('16:9 Master → 9:16 Social Cut');
  });

  it('renders studio showcase with video walkthrough option and video mode', async () => {
    await act(async () => {
      root.render(<AppStudioShowcase />);
    });

    // Check switcher buttons
    const buttons = Array.from(container.querySelectorAll('button'));
    const videoBtn = buttons.find((b) => b.textContent?.includes('Live Video Walkthrough'));
    expect(videoBtn).toBeTruthy();

    // Switch to video mode
    if (videoBtn) {
      await act(async () => {
        videoBtn.click();
      });
      const showcaseVideo = container.querySelector('video[src="/videos/studio-showcase-walkthrough.mp4"]');
      expect(showcaseVideo).toBeTruthy();
      expect(container.textContent).toContain('Full Studio Walkthrough / 1080p Master');
    }
  });

  it('opens video walkthrough modal on Hero play button click', async () => {
    const trackPreview = vi.fn();
    await act(async () => {
      root.render(
        <Hero
          founder={true}
          previewEnabled={false}
          previewHref="#waitlist"
          trackPreview={trackPreview}
        />
      );
    });

    const playLink = Array.from(container.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('See how indii.music works')
    );
    expect(playLink).toBeTruthy();

    await act(async () => {
      playLink?.click();
    });

    expect(trackPreview).toHaveBeenCalledWith('hero_watch_video');
    const modal = document.querySelector('[role="dialog"]');
    expect(modal).toBeTruthy();
    const modalVideo = modal?.querySelector('video');
    expect(modalVideo?.getAttribute('src')).toBe('/videos/indii-overview.mp4');
  });
});
