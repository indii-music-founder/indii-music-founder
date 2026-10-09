import { describe, expect, it } from 'vitest';
import { buildOmniResponseFormat } from './omniResponseFormat';

describe('Omni response format', () => {
  it.each(['16:9', '9:16'] as const)('omits new framing and duration for an edit requested with %s', aspectRatio => {
    expect(buildOmniResponseFormat('edit', aspectRatio, '720p', 8)).toEqual({
      type: 'video',
      resolution: '720p',
      delivery: 'inline',
    });
  });

  it.each(['text_to_video', 'image_to_video', 'reference_to_video', 'extend'] as const)(
    'preserves requested output controls for %s', task => {
      expect(buildOmniResponseFormat(task, '9:16', '1080p', 6)).toEqual({
        type: 'video',
        aspect_ratio: '9:16',
        duration: '6s',
        resolution: '1080p',
        delivery: 'inline',
      });
    },
  );
});
