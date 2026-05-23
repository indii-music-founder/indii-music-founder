const fs = require('fs');
const { execSync } = require('child_process');
const { Storage } = require('@google-cloud/storage');

const newKeyPath = '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/99d0961b-4202-4447-b399-80811b7e0228/scratch/new_project_key.json';
const logFilePath = '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/99d0961b-4202-4447-b399-80811b7e0228/.system_generated/tasks/task-5564.log';

const srcBucketName = 'indiios-v-1-1.firebasestorage.app';
const destBucketName = 'indii-music-assets';

async function run() {
  console.log('====================================================');
  console.log('          REST Storage Bucket Migration');
  console.log('====================================================');

  console.log('Reading source files list from log...');
  if (!fs.existsSync(logFilePath)) {
    throw new Error(`Log file not found at ${logFilePath}. Please ensure task-5564 completed successfully.`);
  }

  const logContent = fs.readFileSync(logFilePath, 'utf8');
  const fileLines = logContent.split('\n');
  const filesToCopy = [];

  for (const line of fileLines) {
    // Strip line number prefix (e.g. "8: gs://...")
    const cleanLine = line.replace(/^\d+:\s*/, '').trim();
    if (cleanLine.startsWith(`gs://${srcBucketName}/`)) {
      const filePath = cleanLine.substring(`gs://${srcBucketName}/`.length);
      if (filePath && !filePath.endsWith('/')) {
        filesToCopy.push(filePath);
      }
    }
  }

  console.log(`Parsed ${filesToCopy.length} files to copy.\n`);

  console.log('Getting user credentials via gcloud print-access-token...');
  const accessToken = execSync('gcloud auth print-access-token').toString().trim();

  console.log('Initializing destination storage client...');
  const newStorage = new Storage({ keyFilename: newKeyPath });
  const destBucket = newStorage.bucket(destBucketName);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < filesToCopy.length; i++) {
    const filePath = filesToCopy[i];
    console.log(`[${i + 1}/${filesToCopy.length}] Copying: ${filePath}...`);

    try {
      // 1. Download via REST API using user token
      const url = `https://storage.googleapis.com/storage/v1/b/${srcBucketName}/o/${encodeURIComponent(filePath)}?alt=media`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP download error: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Get content-type from headers if present, otherwise guess or get metadata from API
      let contentType = response.headers.get('content-type') || 'application/octet-stream';
      if (contentType.includes('application/json')) {
        // GCS metadata endpoint can be queried if alt=media gives generic types, but we can infer from extensions
        if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
          contentType = 'image/jpeg';
        } else if (filePath.endsWith('.png')) {
          contentType = 'image/png';
        } else if (filePath.endsWith('.mp4')) {
          contentType = 'video/mp4';
        }
      }

      // 2. Upload to destination using storage SDK
      const destFile = destBucket.file(filePath);
      await destFile.save(buffer, {
        metadata: {
          contentType: contentType,
          cacheControl: 'public, max-age=31536000'
        }
      });

      console.log(`    Successfully copied ${filePath} (${buffer.length} bytes, type: ${contentType})`);
      successCount++;
    } catch (err) {
      console.error(`    FAILED to copy ${filePath}:`, err.message);
      failCount++;
    }
  }

  console.log('\n====================================================');
  console.log('       REST Storage Migration Summary');
  console.log('====================================================');
  console.log(`Total Objects Parsed:    ${filesToCopy.length}`);
  console.log(`Successfully Copied:     ${successCount}`);
  console.log(`Failed Copies:           ${failCount}`);
  console.log('====================================================');

  process.exit(failCount > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('\nStorage Migration process failed:', err);
  process.exit(1);
});
