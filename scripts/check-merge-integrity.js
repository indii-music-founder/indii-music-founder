import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const markerPatterns = [
  { label: 'merge marker <<<<<<<', regex: /^<{7}/ },
  { label: 'merge marker |||||||', regex: /^\|{7}/ },
  { label: 'merge marker =======', regex: /^={7}$/ },
  { label: 'merge marker >>>>>>>', regex: /^>{7}/ }
];

const binaryExtensions = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.bmp',
  '.webp',
  '.svg',
  '.ico',
  '.ttf',
  '.otf',
  '.woff',
  '.woff2',
  '.mp3',
  '.mp4',
  '.mov',
  '.avi',
  '.pdf'
]);

const repositoryRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' })
  .trim();
const trackedFiles = execSync('git ls-files', { encoding: 'utf8', cwd: repositoryRoot })
  .split('\n')
  .filter(Boolean);

const issues = [];

for (const file of trackedFiles) {
  const extension = path.extname(file).toLowerCase();
  if (binaryExtensions.has(extension)) continue;

  let content;
  try {
    content = readFileSync(path.join(repositoryRoot, file), 'utf8');
  } catch {
    continue;
  }

  const lines = content.split(/\r?\n/);
  for (const { label, regex } of markerPatterns) {
    const lineIndex = lines.findIndex((line) => regex.test(line));
    if (lineIndex !== -1) {
      issues.push({ file, label, line: lineIndex + 1 });
    }
  }
}

for (const jsonFile of ['package.json', 'package-lock.json']) {
  const filePath = path.join(repositoryRoot, jsonFile);
  try {
    const raw = readFileSync(filePath, 'utf8');
    JSON.parse(raw);
  } catch (error) {
    issues.push({ file: jsonFile, label: `Invalid JSON: ${error.message}` });
  }
}

if (issues.length) {
  console.error('Merge integrity checks failed:');
  for (const issue of issues) {
    const location = issue.line ? `${issue.file}:${issue.line}` : issue.file;
    console.error(`- ${location} – ${issue.label}`);
  }
  process.exit(1);
}

console.log('No merge markers or JSON errors detected.');
