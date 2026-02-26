import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const target = path.join(__dirname, 'node_modules');
console.log('Testing lstat on:', target);

try {
    const stats = fs.lstatSync(target);
    console.log('SUCCESS: lstat succeeded');
    console.log('Is directory:', stats.isDirectory());
} catch (e) {
    console.error('FAILURE: lstat failed');
    console.error(e);
}
