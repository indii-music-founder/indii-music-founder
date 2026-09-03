import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const GIT_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null'
};

// Get list of files modified/added in current branch and uncommitted changes
function getModifiedFiles() {
  try {
    const files = new Set();
    
    // 1. Get changed files in current branch vs main
    try {
      const branchDiff = execSync('git diff --name-only main..HEAD', { encoding: 'utf-8', env: GIT_ENV }).trim();
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
      const diffHead = execSync('git diff HEAD --name-only', { encoding: 'utf-8', env: GIT_ENV }).trim();
      if (diffHead) {
        diffHead.split('\n').forEach(f => {
          if (f.trim()) files.add(path.resolve(f.trim()));
        });
      }
    } catch (e) {}

    // 3. Get staged changes
    try {
      const diffCached = execSync('git diff --cached --name-only', { encoding: 'utf-8', env: GIT_ENV }).trim();
      if (diffCached) {
        diffCached.split('\n').forEach(f => {
          if (f.trim()) files.add(path.resolve(f.trim()));
        });
      }
    } catch (e) {}

    // 4. Get untracked and modified porcelain files
    try {
      const statusOutput = execSync('git status --porcelain', { encoding: 'utf-8', env: GIT_ENV }).trim();
      if (statusOutput) {
        statusOutput.split('\n').forEach(line => {
          const file = line.substring(3).trim();
          if (file) files.add(path.resolve(file));
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
  if (filePath.endsWith('check-test-quality.js')) {
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

    // Test file specific checks
    if (isTestFile) {
      // 1. Check for commented out assertions
      const commentedAssertMatch = line.match(/\/\/\s*expect\(/) || line.match(/\/\*\s*expect\(/);
      if (commentedAssertMatch && !line.includes('bypass-test-quality')) {
        issues.push({
          lineNum,
          pattern: commentedAssertMatch[0],
          message: 'Commented-out test assertion detected. Do not comment out expect() assertions to bypass failures.',
        });
      }

      // 2. Check for Playwright strict mode workarounds: .first(), .last(), .nth(...)
      const strictBypassMatch = line.match(/\.(first|last|nth)\(/);
      if (strictBypassMatch && !line.includes('bypass-strict') && !line.includes('bypass-test-quality')) {
        issues.push({
          lineNum,
          pattern: strictBypassMatch[0],
          message: `Strict-mode locator bypass (${strictBypassMatch[0]}) detected. Investigate duplicate elements or add an inline comment with // bypass-strict.`,
        });
      }

      // 3. Anti-Pattern 10: Tautological & Potemkin Assertions (expect(true).toBe(true))
      const tautologyMatch = line.match(/expect\(\s*(true|false|1|0)\s*\)\.to(Be|Equal)\(\s*\1\s*\)/);
      if (tautologyMatch && !line.includes('bypass-test-quality')) {
        issues.push({
          lineNum,
          pattern: tautologyMatch[0],
          message: 'Tautological assertion detected (e.g. expect(true).toBe(true)). Assert real functional states instead of no-op assertions.',
        });
      }

      // 4. Focused test leak: .only in test files
      const focusedMatch = line.match(/\b(it|test|describe)\.only\s*\(/);
      if (focusedMatch && !line.includes('bypass-test-quality')) {
        issues.push({
          lineNum,
          pattern: focusedMatch[0],
          message: 'Focused test (.only) detected. Remove before committing to prevent skipping tests in CI.',
        });
      }
    }

    // 5. Anti-Pattern 12: Banned AI Model Strings
    const bannedModelMatch = line.match(/['"`](gemini-(1\.5-(pro|flash)|2\.0-(pro|flash)|pro(-vision)?))['"`]/);
    if (bannedModelMatch && !filePath.includes('validateModels.test.ts') && !filePath.includes('ai-models.ts') && !line.includes('bypass-test-quality')) {
      issues.push({
        lineNum,
        pattern: bannedModelMatch[0],
        message: `Banned AI model literal (${bannedModelMatch[0]}) detected. Use AI_MODELS constants from @/core/config/ai-models.`,
      });
    }

    // 6. Anti-Pattern 9: Hardcoded Infrastructure Identifiers (Frontend)
    if (!isTestFile && filePath.includes('packages/renderer/src') && !filePath.includes('fine-tuned-endpoints.generated.ts')) {
      const infraMatch = line.match(/(endpoints\/[0-9]{6,}|locations\/(us|us-central1|global)\/endpoints\/[0-9]{6,}|projects\/[0-9]{6,}\/locations\/)/);
      if (infraMatch && !line.includes('bypass-test-quality')) {
        issues.push({
          lineNum,
          pattern: infraMatch[0],
          message: `Hardcoded infrastructure identifier (${infraMatch[0]}) detected. Infra IDs belong in generated config or runtime discovery, not inline in source code.`,
        });
      }
    }
  }

  return issues;
}

function getAllFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.git', 'dist', 'coverage', '.genkit', 'build'].includes(entry.name)) {
        getAllFiles(fullPath, files);
      }
    } else if (['.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs'].includes(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

function run() {
  const scanAll = process.argv.includes('--all');
  console.log(`--- Running Test Quality & Agent Anti-Pattern Scan ${scanAll ? '(ALL FILES)' : '(DIFF MODE)'} ---`);
  const files = scanAll
    ? [...getAllFiles(path.resolve(process.cwd(), 'packages')), ...getAllFiles(path.resolve(process.cwd(), 'e2e'))]
    : getModifiedFiles();

  if (files.length === 0) {
    console.log('No modified or added files detected. Skipped.');
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
