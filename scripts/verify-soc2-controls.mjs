#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const rootDir = process.cwd();
const controlsPath = path.join(rootDir, 'compliance/controls/controls.yaml');

console.log('🔍 Validating indii.music SOC 2 Control Registry...');

if (!fs.existsSync(controlsPath)) {
  console.error(`❌ Error: ${controlsPath} does not exist.`);
  process.exit(1);
}

const fileContent = fs.readFileSync(controlsPath, 'utf8');
let registry;
try {
  registry = yaml.load(fileContent);
} catch (err) {
  console.error(`❌ YAML Parse Error:`, err);
  process.exit(1);
}

if (!registry || !Array.isArray(registry.controls)) {
  console.error('❌ Registry must contain a top-level `controls` array.');
  process.exit(1);
}

const requiredFields = [
  'control',
  'name',
  'criteria',
  'owner',
  'system',
  'evidence',
  'frequency',
  'status',
  'policy_ref',
  'description',
];

const validStatuses = new Set([
  'done',
  'verify',
  'build',
  'document',
  'implemented',
  'in_progress',
  'planned',
]);

const controlIdRegex = /^INDII-[A-Z]{2,6}-\d{3}$/;

let errors = [];
let controlIds = new Set();
let stats = {
  total: registry.controls.length,
  done: 0,
  verify: 0,
  build: 0,
  document: 0,
};

for (const ctrl of registry.controls) {
  // Support either 'id' or 'control'
  if (ctrl.id && !ctrl.control) {
    ctrl.control = ctrl.id;
  }

  // Required fields check
  for (const field of requiredFields) {
    if (!ctrl[field]) {
      errors.push(`[${ctrl.control || 'UNKNOWN'}] Missing required field: ${field}`);
    }
  }

  // ID format check
  if (ctrl.control) {
    if (!controlIdRegex.test(ctrl.control)) {
      errors.push(`[${ctrl.control}] Invalid ID format. Expected INDII-XX-000 or INDII-FAMILY-000.`);
    }
    if (controlIds.has(ctrl.control)) {
      errors.push(`[${ctrl.control}] Duplicate control ID detected.`);
    }
    controlIds.add(ctrl.control);
  }

  // Status check
  if (ctrl.status) {
    if (!validStatuses.has(ctrl.status)) {
      errors.push(`[${ctrl.control}] Invalid status '${ctrl.status}'. Must be one of: ${[...validStatuses].join(', ')}`);
    } else {
      // Map implemented -> done, in_progress -> verify, planned -> build for summary
      const canonicalStatus = 
        ctrl.status === 'implemented' ? 'done' :
        ctrl.status === 'in_progress' ? 'verify' :
        ctrl.status === 'planned' ? 'build' : ctrl.status;
      stats[canonicalStatus] = (stats[canonicalStatus] || 0) + 1;
    }
  }

  // Systems check
  if (ctrl.system && !Array.isArray(ctrl.system)) {
    errors.push(`[${ctrl.control}] 'system' must be an array of strings.`);
  }

  // Evidence check
  if (ctrl.evidence && !Array.isArray(ctrl.evidence)) {
    errors.push(`[${ctrl.control}] 'evidence' must be an array of strings.`);
  }

  // Policy ref existence check (warn or fail)
  if (ctrl.policy_ref) {
    const policyPath = path.join(rootDir, ctrl.policy_ref);
    if (!fs.existsSync(policyPath)) {
      errors.push(`[${ctrl.control}] Referenced policy file does not exist: ${ctrl.policy_ref}`);
    }
  }
}

if (errors.length > 0) {
  console.error(`\n❌ Found ${errors.length} validation issues in SOC 2 Control Registry:\n`);
  for (const err of errors) {
    console.error(` - ${err}`);
  }
  process.exit(1);
}

// Generate JSON registry artifact for fast imports
const jsonOutputPath = path.join(rootDir, 'compliance/controls/registry.json');
fs.writeFileSync(jsonOutputPath, JSON.stringify(registry, null, 2), 'utf8');

console.log(`✅ SOC 2 Control Registry is valid!`);
console.log(`📊 Statistics:`);
console.log(`   - Total Controls: ${stats.total}`);
console.log(`   - Done / Impl:    ${stats.done}`);
console.log(`   - Verify / InProg:${stats.verify}`);
console.log(`   - Build / Plan:   ${stats.build}`);
console.log(`   - Document:       ${stats.document}`);
console.log(`📁 Synced JSON registry to ${path.relative(rootDir, jsonOutputPath)}\n`);
