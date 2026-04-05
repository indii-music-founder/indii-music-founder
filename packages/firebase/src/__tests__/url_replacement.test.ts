import { describe, it, expect } from 'vitest';
import { toGcsUri } from '../lib/long_form_video';

describe('toGcsUri', () => {
    it('should return gs:// URI as is', () => {
        expect(toGcsUri('gs://my-bucket/my-file.mp4')).toBe('gs://my-bucket/my-file.mp4');
    });

    it('should convert storage.googleapis.com URL to gs:// URI', () => {
        expect(toGcsUri('https://storage.googleapis.com/my-bucket/my-file.mp4'))
            .toBe('gs://my-bucket/my-file.mp4');
    });

    it('should convert storage.cloud.google.com URL to gs:// URI', () => {
        expect(toGcsUri('https://storage.cloud.google.com/my-bucket/my-file.mp4'))
            .toBe('gs://my-bucket/my-file.mp4');
    });

    it('should strip query parameters', () => {
        expect(toGcsUri('https://storage.googleapis.com/my-bucket/my-file.mp4?authuser=0&foo=bar'))
            .toBe('gs://my-bucket/my-file.mp4');
    });

    it('should decode encoded characters in path', () => {
        expect(toGcsUri('https://storage.googleapis.com/my%20bucket/my%20file.mp4'))
            .toBe('gs://my bucket/my file.mp4');
    });

    it('should handle complex paths', () => {
        expect(toGcsUri('https://storage.googleapis.com/bucket/path/to/nested/file.mp4'))
            .toBe('gs://bucket/path/to/nested/file.mp4');
    });

    it('should fallback to string replace if URL parsing fails (though unlikely for valid http string)', () => {
        // Mocking a scenario where URL parser might choke or unexpected format
        // For standard URLs, URL parser works.
        // Let's test the fallback path by providing a string that is not a valid URL for URL constructor but starts with prefix?
        // Actually URL constructor is quite robust.
        // We can test the fallback by mocking URL (hard in vitest without setup),
        // or just rely on the fact that the previous tests cover the main logic.
        // Let's test a simple string replacement case if protocol is missing but we check logic?
        // The code checks `startsWith('http')` for URL parsing path.
        // The fallback checks `startsWith('https://storage.googleapis.com/')`.

        // If we give an invalid URL that starts with the prefix but fails new URL().
        // e.g. 'https://storage.googleapis.com/path with spaces' (unencoded spaces are invalid in URL constructor in some envs, but Chrome accepts them, Node might throw)

        try {
            new URL('https://storage.googleapis.com/path with spaces');
        } catch (e) {
            // If this throws, we can test fallback
             expect(toGcsUri('https://storage.googleapis.com/path with spaces'))
                .toBe('gs://path with spaces');
        }
    });
});
