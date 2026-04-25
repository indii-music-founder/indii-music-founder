#!/usr/bin/env node

/**
 * check-performance-budget.js
 * Performance budget checker for CI/CD pipeline
 *
 * Analyzes built bundle and compares against configured budget thresholds.
 * Fails the build if any budget is exceeded.
 */

const fs = require('fs');
const path = require('path');

const BUDGET = {
  jsLimit: 500 * 1024, // 500 KB
  cssLimit: 100 * 1024, // 100 KB
  totalLimit: 700 * 1024, // 700 KB
};

const DIST_DIR = path.join(__dirname, '../dist');

function getFileSizes() {
  if (!fs.existsSync(DIST_DIR)) {
    console.warn(`⚠️  dist directory not found at ${DIST_DIR}`);
    return null;
  }

  const files = fs.readdirSync(DIST_DIR, { recursive: true });
  let jsSize = 0;
  let cssSize = 0;

  files.forEach(file => {
    if (typeof file === 'string') {
      const fullPath = path.join(DIST_DIR, file);
      if (fs.statSync(fullPath).isFile()) {
        const size = fs.statSync(fullPath).size;
        if (file.endsWith('.js')) jsSize += size;
        if (file.endsWith('.css')) cssSize += size;
      }
    }
  });

  return { jsSize, cssSize, totalSize: jsSize + cssSize };
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function checkBudget() {
  const sizes = getFileSizes();
  if (!sizes) process.exit(1);

  console.log('\n📊 Bundle Size Analysis');
  console.log('=======================\n');
  console.log(`JS Size:    ${formatSize(sizes.jsSize)} / ${formatSize(BUDGET.jsLimit)}`);
  console.log(`CSS Size:   ${formatSize(sizes.cssSize)} / ${formatSize(BUDGET.cssLimit)}`);
  console.log(`Total Size: ${formatSize(sizes.totalSize)} / ${formatSize(BUDGET.totalLimit)}\n`);

  const violations = [];

  if (sizes.jsSize > BUDGET.jsLimit) {
    violations.push(`JS exceeds budget: ${formatSize(sizes.jsSize)} > ${formatSize(BUDGET.jsLimit)}`);
  }

  if (sizes.cssSize > BUDGET.cssLimit) {
    violations.push(`CSS exceeds budget: ${formatSize(sizes.cssSize)} > ${formatSize(BUDGET.cssLimit)}`);
  }

  if (sizes.totalSize > BUDGET.totalLimit) {
    violations.push(`Total exceeds budget: ${formatSize(sizes.totalSize)} > ${formatSize(BUDGET.totalLimit)}`);
  }

  if (violations.length > 0) {
    console.error('❌ Performance Budget FAILED\n');
    violations.forEach(v => console.error(`   • ${v}`));
    process.exit(1);
  } else {
    console.log('✅ Performance Budget PASSED\n');
    process.exit(0);
  }
}

checkBudget();
