
declare var process: {
  env: {
    API_KEY: string;
    [key: string]: string | undefined;
  }
};

export async function ensureApiKey(force = false) {
    if (window.aistudio && window.aistudio.openSelectKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey || force) {
            await window.aistudio.openSelectKey();
        }
    }
}

export function shouldRetryAuth(err: any): boolean {
    const s = err.toString();
    const m = err.message || '';
    return (
        s.includes('403') || m.includes('PERMISSION_DENIED') || err.status === 403 ||
        s.includes('Requested entity was not found') || m.includes('Requested entity was not found')
    );
}

export function cleanJSON(text: string): string {
    if (!text) return '{}';
    text = text.replace(/```json\s*([\s\S]*?)\s*```/g, '$1');
    text = text.replace(/```\s*([\s\S]*?)\s*```/g, '$1');
    const firstBrace = text.indexOf('{');
    const firstBracket = text.indexOf('[');
    let startIndex = -1;
    if (firstBrace !== -1 && firstBracket !== -1) startIndex = Math.min(firstBrace, firstBracket);
    else if (firstBrace !== -1) startIndex = firstBrace;
    else if (firstBracket !== -1) startIndex = firstBracket;
    if (startIndex === -1) return '{}';
    let endIndex = text.lastIndexOf('}');
    const lastBracket = text.lastIndexOf(']');
    if (lastBracket > endIndex) endIndex = lastBracket;
    if (endIndex === -1) return '{}';
    return text.substring(startIndex, endIndex + 1);
}

export function getClosestAspectRatio(width: number, height: number): "1:1" | "16:9" | "9:16" | "4:3" | "3:4" {
    const ratio = width / height;
    const targets = {
        "1:1": 1,
        "16:9": 1.77,
        "9:16": 0.56,
        "4:3": 1.33,
        "3:4": 0.75
    };
    let closest = "1:1";
    let minDiff = Infinity;
    for (const [key, val] of Object.entries(targets)) {
        const diff = Math.abs(ratio - val);
        if (diff < minDiff) {
            minDiff = diff;
            closest = key;
        }
    }
    return closest as any;
}

export async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export function dataURItoBlob(dataURI: string): Blob {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
}

export async function extractVideoFrame(videoDataUri: string): Promise<{ base64: string, width: number, height: number }> {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.crossOrigin = "anonymous"; 
        video.src = videoDataUri;
        video.muted = true;
        video.playsInline = true;
        
        const onLoaded = () => {
             // Seek to the very end
             video.currentTime = video.duration > 0.1 ? video.duration - 0.1 : 0;
        };

        const onSeeked = () => {
            const cvs = document.createElement('canvas');
            cvs.width = video.videoWidth || 1280;
            cvs.height = video.videoHeight || 720;
            const ctx = cvs.getContext('2d');
            if(ctx) {
                ctx.drawImage(video, 0, 0);
                resolve({
                    base64: cvs.toDataURL('image/jpeg'),
                    width: cvs.width,
                    height: cvs.height
                });
            } else {
                reject("Canvas context failed");
            }
            // Cleanup
            video.remove();
        };

        video.onloadeddata = onLoaded;
        video.onseeked = onSeeked;
        video.onerror = (e) => reject(e);
        
        video.load();
    });
}
