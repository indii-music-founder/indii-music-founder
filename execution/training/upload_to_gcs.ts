import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const token = execSync('gcloud auth print-access-token').toString().trim();
const bucket = 'indii-training-data';

const filesToUpload = [
    'event-planner_train.jsonl',
    'event-planner_eval.jsonl',
    'hospitality_train.jsonl',
    'hospitality_eval.jsonl'
];

async function uploadFile(filename: string) {
    const filePath = path.join(__dirname, '../../ft_export', filename);
    const destinationName = `ft_export/r8/${filename}`;
    
    if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        return;
    }

    const content = fs.readFileSync(filePath);
    
    console.log(`Uploading ${filename}...`);
    
    const res = await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(destinationName)}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/octet-stream'
        },
        body: content
    });

    if (!res.ok) {
        const err = await res.text();
        console.error(`❌ Failed to upload ${filename}: ${res.status} ${err}`);
    } else {
        console.log(`✅ Uploaded ${filename} successfully!`);
    }
}

async function main() {
    for (const file of filesToUpload) {
        await uploadFile(file);
    }
}

main();
