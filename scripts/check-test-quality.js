import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Get list of files modified/added in current branch and uncommitted changes
function getModifiedFiles() {
  try {
    const files = new Set();
    
    // 1. Get changed files in current branch vs main
    try {
      const branchDiff = execSync('git diff --name-only main..HEAD', { encoding: 'utf-8' }).trim();
      if (branchDiff) {
        branchDiff.split('\n').forEach(f => {
          if (f.trim()) files.add(path.resolve(f.trim()));
        });
      }
    } catch (e) {
      // Fallback if main branch not present locally or error occurs
    }

    // 2. Get unstaged changes
    try {
      const diffHead = execSync('git diff HEAD --name-only', { encoding: 'utf-8' }).trim();
      if (diffHead) {
        diffHead.split('\n').forEach(f => {
          if (f.trim()) files.add(path.resolve(f.trim()));
        });
      }
    } catch (e) {}

    // 3. Get staged changes
    try {
      const diffCached = execSync('git diff --cached --name-only', { encoding: 'utf-8' }).trim();
      if (diffCached) {
        diffCached.split('\n').forEach(f => {
          if (f.trim()) files.add(path.resolve(f.trim()));
        });
      }
    } catch (e) {}

    return Array.from(files);
  } catch (error) {
    console.error('Error getting git diff:', error.message);
    return [];
  }
}

function scanFile(filePath) {
  const ext = path.extname(filePath);
  if (!['.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs'].includes(ext)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const issues = [];

  const isTestFile = filePath.includes('.spec.ts') || 
                     filePath.includes('.test.ts') || 
                     filePath.includes('.spec.tsx') || 
                     filePath.includes('.test.tsx') || 
                     filePath.includes('e2e/');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // 1. Check for commented out assertions: e.g. // expect(...) or /* expect(...)
    const commentedAssertMatch = line.match(/\/\/\s*expect\(/) || line.match(/\/\*\s*expect\(/);
    if (commentedAssertMatch && !line.includes('bypass-test-quality')) {
      issues.push({
        lineNum,
        pattern: commentedAssertMatch[0],
        message: 'Commented-out test assertion detected. Do not comment out expect() assertions to bypass failures.',
      });
    }

    // 2. Check for Playwright strict mode workarounds: .first(), .last(), .nth(...)
    if (isTestFile) {
      const strictBypassMatch = line.match(/\.(first|last|nth)\(/);
      if (strictBypassMatch && !line.includes('bypass-strict') && !line.includes('bypass-test-quality')) {
        issues.push({
          lineNum,
          pattern: strictBypassMatch[0],
          message: `Strict-mode locator bypass (${strictBypassMatch[0]}) detected. Investigate the duplicate elements root cause or add an inline comment with // bypass-strict if verified as correct/harmless.`,
        });
      }
    }
  }

  return issues;
}

function run() {
  console.log('--- Running Test Quality & Agent Anti-Pattern Scan ---');
  const files = getModifiedFiles();
  if (files.length === 0) {
    console.log('No modified or added files detected in git diff. Skipped.');
    process.exit(0);
  }

  let totalIssues = 0;

  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const relativePath = path.relative(process.cwd(), file);
    
    // Skip node_modules or system files
    if (relativePath.includes('node_modules') || relativePath.includes('.git')) {
      continue;
    }

    const fileIssues = scanFile(file);
    if (fileIssues.length > 0) {
      console.log(`\n❌ ${relativePath}:`);
      fileIssues.forEach(issue => {
        console.log(`  Line ${issue.lineNum}: [${issue.pattern}] ${issue.message}`);
        totalIssues++;
      });
    }
  }

  if (totalIssues > 0) {
    console.log(`\nScan failed: Found ${totalIssues} test quality / anti-pattern violation(s).`);
    console.log('Resolve these violations or bypass them with inline comments: // bypass-strict or // bypass-test-quality');
    process.exit(1);
  }

  console.log('Scan completed successfully. No violations found.');
  process.exit(0);
}

run();
