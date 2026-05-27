const { Storage } = require('@google-cloud/storage');

const oldKeyPath = '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/99d0961b-4202-4447-b399-80811b7e0228/scratch/old_project_key.json';
const newKeyPath = '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/99d0961b-4202-4447-b399-80811b7e0228/scratch/new_project_key.json';

const srcBucketName = 'indii-music-founder.firebasestorage.app';
const destBucketName = 'indii-music-assets';

async function migrate() {
  console.log('====================================================');
  console.log('            Storage Bucket Migration');
  console.log('====================================================');

  console.log(`Initializing source storage bucket: ${srcBucketName}...`);
  const oldStorage = new Storage({ keyFilename: oldKeyPath });
  const srcBucket = oldStorage.bucket(srcBucketName);

  console.log(`Initializing destination storage bucket: ${destBucketName}...`);
  const newStorage = new Storage({ keyFilename: newKeyPath });
  const destBucket = newStorage.bucket(destBucketName);

  console.log('Listing all files recursively in source bucket...');
  const [files] = await srcBucket.getFiles();
  console.log(`Found ${files.length} objects to migrate.\n`);

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    // Skip placeholder directories
    if (file.name.endsWith('/') && file.metadata.size === '0') {
      console.log(`[${i + 1}/${files.length}] Skipping directory placeholder: ${file.name}`);
      skipCount++;
      continue;
    }

    console.log(`[${i + 1}/${files.length}] Copying: ${file.name}...`);
    try {
      // 1. Download file content
      const [buffer] = await file.download();

      // 2. Get original metadata (content-type etc.)
      const [metadata] = await file.getMetadata();

      // 3. Save to destination
      const destFile = destBucket.file(file.name);
      await destFile.save(buffer, {
        metadata: {
          contentType: metadata.contentType || 'application/octet-stream',
          cacheControl: metadata.cacheControl
        }
      });
      
      console.log(`    Successfully copied ${file.name} (${buffer.length} bytes)`);
      successCount++;
    } catch (err) {
      console.error(`    FAILED to copy ${file.name}:`, err.message);
      failCount++;
    }
  }

  console.log('\n====================================================');
  console.log('          Storage Migration Summary');
  console.log('====================================================');
  console.log(`Total Objects Processed: ${files.length}`);
  console.log(`Successfully Copied:     ${successCount}`);
  console.log(`Skipped (Placeholders):  ${skipCount}`);
  console.log(`Failed Copies:           ${failCount}`);
  console.log('====================================================');

  process.exit(failCount > 0 ? 1 : 0);
}

migrate().catch(err => {
  console.error('\nStorage Migration process failed:', err);
  process.exit(1);
});
