import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { NLETrackScrubCanvas } from './NLETrackScrubCanvas';

describe('NLETrackScrubCanvas (Timeline Track Filmstrip Scrub Canvas)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders canvas element with calculated width, height, and role', () => {
    render(
      <NLETrackScrubCanvas
        src="https://cdn.indii.music/assets/video1.mp4"
        width={320}
        height={64}
        durationInFrames={120}
        fps={30}
      />
    );

    const canvas = screen.getByTestId('nle-track-scrub-canvas');
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveAttribute('width', '320');
    expect(canvas).toHaveAttribute('height', '64');
    expect(canvas).toHaveAttribute('role', 'img');
    expect(canvas).toHaveAttribute('aria-label', expect.stringContaining('video1.mp4'));
  });

  it('handles small / zero dimensions safely without throwing', () => {
    const { container } = render(
      <NLETrackScrubCanvas
        src="https://cdn.indii.music/assets/tiny.mp4"
        width={0}
        height={0}
        durationInFrames={0}
        fps={30}
      />
    );

    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveAttribute('width', '1');
    expect(canvas).toHaveAttribute('height', '1');
  });

  it('renders scrub playhead notch when playheadFrame is within clip range', () => {
    const { rerender } = render(
      <NLETrackScrubCanvas
        src="https://cdn.indii.music/assets/video2.mp4"
        width={400}
        height={64}
        durationInFrames={200}
        fps={30}
        playheadFrame={50}
        isScrubbing={true}
      />
    );

    const canvas = screen.getByTestId('nle-track-scrub-canvas');
    expect(canvas).toBeInTheDocument();

    // Rerender with advanced playhead
    rerender(
      <NLETrackScrubCanvas
        src="https://cdn.indii.music/assets/video2.mp4"
        width={400}
        height={64}
        durationInFrames={200}
        fps={30}
        playheadFrame={150}
        isScrubbing={false}
      />
    );

    expect(canvas).toBeInTheDocument();
  });

  it('handles source in/out ranges properly for sub-clip trimming', () => {
    render(
      <NLETrackScrubCanvas
        src="https://cdn.indii.music/assets/trimmed.mp4"
        width={240}
        height={48}
        durationInFrames={90}
        fps={30}
        sourceInUs={2_000_000}
        sourceOutUs={5_000_000}
      />
    );

    const canvas = screen.getByTestId('nle-track-scrub-canvas');
    expect(canvas).toHaveAttribute('width', '240');
    expect(canvas).toHaveAttribute('height', '48');
  });
});
