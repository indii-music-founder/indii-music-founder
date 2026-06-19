const fs = require('fs');
const path = require('path');

const DEPRECATED_PATTERNS = [
  'AutonomousIntelligence.generateVideo',
  'MediaGenerator.generateVideo',
  'FirebaseIntelligenceService.generateText', // Check if used directly instead of via HighLevelAPI
  'BrowserAgentService', // Legacy fallback
  'DirectImageEditor',   // Legacy fallback
  'FallbackClient',      // Legacy fallback
];

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === 'dist' || file === 'build' || file === '.git') continue;
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      walk(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  }
  return fileList;
}

function findDuplicateTestFiles(files) {
  const testFiles = files.filter(f => f.endsWith('.test.ts') || f.endsWith('.test.tsx'));
  const byName = {};
  for (const f of testFiles) {
    const name = path.basename(f);
    if (!byName[name]) byName[name] = [];
    byName[name].push(f);
  }
  const duplicates = Object.entries(byName).filter(([_, paths]) => paths.length > 1);
  return duplicates;
}

function findDeprecatedUsages(files) {
  const sourceFiles = files.filter(f => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js') || f.endsWith('.jsx'));
  const issues = [];
  
  for (const f of sourceFiles) {
    const content = fs.readFileSync(f, 'utf8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      for (const pattern of DEPRECATED_PATTERNS) {
        if (lines[i].includes(pattern)) {
          issues.push({
            file: f,
            line: i + 1,
            pattern,
            content: lines[i].trim()
          });
        }
      }
    }
  }
  return issues;
}

function runAudit() {
  const allFiles = walk(path.join(__dirname, '..', 'packages'));
  
  console.log('--- DUPLICATE TEST FILES ---');
  const duplicates = findDuplicateTestFiles(allFiles);
  for (const [name, paths] of duplicates) {
    console.log(`\nDuplicate: ${name}`);
    paths.forEach(p => console.log(`  - ${p}`));
  }
  
  console.log('\n--- DEPRECATED USAGES FOUND ---');
  const deprecated = findDeprecatedUsages(allFiles);
  for (const issue of deprecated) {
    console.log(`${issue.file}:${issue.line} -> ${issue.pattern}`);
  }
}

runAudit();
