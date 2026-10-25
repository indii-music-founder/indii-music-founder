import { describe, expect, it } from 'vitest';
import { visualResultNotification } from './mobilePushNotifications';

describe('mobile push event selection', () => {
  it('does not notify for chat or streaming progress', () => {
    expect(visualResultNotification({ text: 'Your job is starting', isFinal: true })).toBeNull();
    expect(visualResultNotification({ isFinal: false, videoUrls: ['https://example.com/video.mp4'] })).toBeNull();
  });

  it('links completed visual artifacts to the canonical mobile Studio route without leaking artifact URLs', () => {
    const video = visualResultNotification({ isFinal: true, videoUrls: ['https://private.example/video.mp4'] });
    expect(video).toEqual({
      title: 'Studio video ready',
      body: 'Open your mobile Studio to review the finished video.',
      url: 'https://app.indii.music/mobile-remote?tab=studio',
    });
    expect(JSON.stringify(video)).not.toContain('private.example');
    expect(visualResultNotification({ isFinal: true, imageUrls: ['https://private.example/image.png'] })?.title).toBe('Studio image ready');
  });
});
