const fs = require('fs');
const { Storage } = require('@google-cloud/storage');

const newKeyPath = '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/99d0961b-4202-4447-b399-80811b7e0228/scratch/new_project_key.json';
const logFilePath = '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/99d0961b-4202-4447-b399-80811b7e0228/.system_generated/tasks/task-5564.log';
const destBucketName = 'indii-music-assets';

async function verify() {
  console.log('====================================================');
  console.log('         Storage Verification System');
  console.log('====================================================');

  console.log('Reading files listed in the original source log...');
  if (!fs.existsSync(logFilePath)) {
    console.error('Source log not found!');
    process.exit(1);
  }
  const logContent = fs.readFileSync(logFilePath, 'utf8');
  const fileLines = logContent.split('\n');
  const expectedFiles = [];
  for (const line of fileLines) {
    const cleanLine = line.replace(/^\d+:\s*/, '').trim();
    if (cleanLine.startsWith('gs://indii-music-founder.firebasestorage.app/')) {
      const filePath = cleanLine.substring('gs://indii-music-founder.firebasestorage.app/'.length);
      if (filePath && !filePath.endsWith('/') && !filePath.endsWith('/:') && filePath !== ':') {
        expectedFiles.push(filePath);
      }
    }
  }
  console.log(`Expected Files in Source: ${expectedFiles.length}`);

  console.log('Listing files in destination bucket...');
  const storage = new Storage({ keyFilename: newKeyPath });
  const bucket = storage.bucket(destBucketName);
  const [files] = await bucket.getFiles();
  console.log(`Actual Files in Destination: ${files.length}`);

  const destFileMap = new Map();
  for (const file of files) {
    destFileMap.set(file.name, parseInt(file.metadata.size || 0));
  }

  let missing = [];
  let zeroSize = [];
  for (const expected of expectedFiles) {
    if (!destFileMap.has(expected)) {
      missing.push(expected);
    } else if (destFileMap.get(expected) === 0) {
      zeroSize.push(expected);
    }
  }

  console.log('\n---------------- Verification Results ----------------');
  console.log(`Total Expected: ${expectedFiles.length}`);
  console.log(`Total Actual:   ${files.length}`);
  console.log(`Missing Files:  ${missing.length}`);
  console.log(`Zero-size Files: ${zeroSize.length}`);
  console.log('------------------------------------------------------');

  if (missing.length > 0) {
    console.log('Sample of missing files:', missing.slice(0, 10));
    process.exit(1);
  } else {
    console.log('All files verified successfully in destination bucket!');
    process.exit(0);
  }
}

verify().catch(err => {
  console.error('Verification failed with error:', err);
  process.exit(1);
});
