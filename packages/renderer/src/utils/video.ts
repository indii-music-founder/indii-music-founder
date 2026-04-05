
export async function extractVideoFrame(videoUrl: string, timeOffset: number = 0): Promise<string> {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.src = videoUrl;
        video.muted = true;
        video.playsInline = true;

        video.onloadedmetadata = () => {
            // Calculate time to seek to
            // If timeOffset is 0 or positive, we might want the LAST frame.
            // If we want specific timestamp, we use it.
            // For Daisy Chain "Last Frame", we want the end.

            let seekTime = video.duration;
            if (timeOffset < 0) {
                // If offset is negative, maybe we want the start? 
                // Or relative to end?
                // For now, let's assume we want the very last frame for daisy chaining.
                seekTime = Math.max(0, video.duration - 0.1);
            } else {
                seekTime = Math.max(0, video.duration - 0.1);
            }

            video.currentTime = seekTime;
        };

        video.onseeked = () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                resolve(dataUrl);
            } else {
                reject(new Error("Could not get canvas context"));
            }
            // Cleanup
            video.src = '';
            video.remove();
        };

        video.onerror = (e) => {
            reject(new Error(`Video loading error: ${e}`));
        };
    });
}
