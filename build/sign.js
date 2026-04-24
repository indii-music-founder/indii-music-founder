// Windows Code Signing Script
// Uses SignTool.exe to sign executable files during Electron Builder process

const { exec } = require('child_process');
const path = require('path');

async function signFile(filePath) {
  if (!process.env.WIN_CSC_LINK || !process.env.WIN_CSC_KEY_PASSWORD) {
    console.log(`[Code Signing] Skipping signature for ${path.basename(filePath)} - credentials not configured`);
    return;
  }

  return new Promise((resolve, reject) => {
    const command = [
      'signtool.exe',
      'sign',
      '/f', process.env.WIN_CSC_LINK,
      '/p', process.env.WIN_CSC_KEY_PASSWORD,
      '/t', 'http://timestamp.sectigo.com',
      '/fd', 'sha256',
      '/td', 'sha256',
      `"${filePath}"`
    ].join(' ');

    console.log(`[Code Signing] Signing ${path.basename(filePath)}...`);

    exec(command, (error) => {
      if (error) {
        console.warn(`[Code Signing] Warning: Failed to sign file: ${error.message}`);
        // Don't reject - signing is optional in development
        return resolve();
      }
      console.log(`[Code Signing] Successfully signed ${path.basename(filePath)}`);
      resolve();
    });
  });
}

exports.default = signFile;
