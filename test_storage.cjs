const { Storage } = require('@google-cloud/storage');

const oldKeyPath = '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/99d0961b-4202-4447-b399-80811b7e0228/scratch/old_project_key.json';
const newKeyPath = '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/99d0961b-4202-4447-b399-80811b7e0228/scratch/new_project_key.json';

async function test() {
  console.log('Initializing old storage...');
  const oldStorage = new Storage({ keyFilename: oldKeyPath });
  const srcBucket = oldStorage.bucket('indiios-alpha-electron');

  console.log('Initializing new storage...');
  const newStorage = new Storage({ keyFilename: newKeyPath });
  const destBucket = newStorage.bucket('indii-music-assets');

  console.log('Testing read from old bucket ingest_test_document.txt...');
  const file = srcBucket.file('ingest_test_document.txt');
  const [content] = await file.download();
  console.log('Download successful! Content:', content.toString());

  console.log('Uploading to new bucket...');
  const destFile = destBucket.file('ingest_test_document.txt');
  await destFile.save(content);
  console.log('Upload successful!');
}

test().catch(err => {
  console.error('Test failed:', err);
});
