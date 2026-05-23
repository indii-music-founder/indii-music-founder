const fs = require('fs');
const path = '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/99d0961b-4202-4447-b399-80811b7e0228/.system_generated/logs/transcript.jsonl';
const lines = fs.readFileSync(path, 'utf8').split('\n');
let count = 1;
for (const line of lines) {
  if (!line) continue;
  const obj = JSON.parse(line);
  if (obj.type === 'USER_INPUT' && obj.source === 'USER_EXPLICIT') {
    const match = obj.content.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/);
    if (match) {
      if (count <= 20) {
        console.log(`\n--- REQUEST ${count} ---`);
        console.log(match[1].trim());
      }
      count++;
    }
  }
}
