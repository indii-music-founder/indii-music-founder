const fs = require('fs');
const p = 'packages/firebase/src/social/deliverScheduledPosts.ts';
let code = fs.readFileSync(p, 'utf8');

const target = `        const boundary = 'foo_bar_baz';
        const bodyStart = \`--\${boundary}\\r\\nContent-Type: application/json; charset=UTF-8\\r\\n\\r\\n\${JSON.stringify(metadata)}\\r\\n--\${boundary}\\r\\nContent-Type: video/*\\r\\n\\r\\n\`;
        const bodyEnd = \`\\r\\n--\${boundary}--\`;
        
        const res = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status', {
            method: 'POST',
            headers: {
                'Authorization': \`Bearer \${token.accessToken}\`,
                'Content-Type': \`multipart/related; boundary=\${boundary}\`
            },
            body: bodyStart + (post.mediaUrl || '') + bodyEnd
        });`;

const replacement = `        let videoBuffer = null;
        if (post.mediaUrl) {
            const mediaRes = await fetch(post.mediaUrl);
            if (!mediaRes.ok) throw new Error(\`Failed to fetch media from \${post.mediaUrl}\`);
            videoBuffer = await mediaRes.arrayBuffer();
        }

        const boundary = 'foo_bar_baz';
        const bodyStart = Buffer.from(\`--\${boundary}\\r\\nContent-Type: application/json; charset=UTF-8\\r\\n\\r\\n\${JSON.stringify(metadata)}\\r\\n--\${boundary}\\r\\nContent-Type: video/*\\r\\n\\r\\n\`);
        const bodyEnd = Buffer.from(\`\\r\\n--\${boundary}--\`);
        
        const body = Buffer.concat([
            bodyStart,
            videoBuffer ? Buffer.from(videoBuffer) : Buffer.alloc(0),
            bodyEnd
        ]);

        const res = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status', {
            method: 'POST',
            headers: {
                'Authorization': \`Bearer \${token.accessToken}\`,
                'Content-Type': \`multipart/related; boundary=\${boundary}\`
            },
            body: body
        });`;

code = code.replace(target, replacement);
fs.writeFileSync(p, code);
