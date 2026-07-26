#!/usr/bin/env node

/**
 * Prevent server-side Google AI traffic from drifting back to Gemini Developer
 * API keys. Test fixtures are deliberately excluded: this guard protects code
 * that can be deployed from packages/firebase/src.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const sourceRoot = join(root, 'packages/firebase/src');
const violations = [];

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    if (!entry.isFile() || !entry.name.endsWith('.ts')) return [];
    if (/(?:^|\.)test\.ts$/.test(entry.name) || directory.includes('/__tests__')) return [];
    return [fullPath];
  });
}

const forbidden = [
  { label: 'Gemini Developer API host', expression: /generativelanguage\.googleapis\.com/ },
  { label: 'Gemini Developer API secret', expression: /\b(?:getGeminiApiKey|geminiApiKey|GEMINI_API_KEY|GOOGLE_GENAI_API_KEY)\b/ },
  { label: 'GoogleGenAI API-key constructor', expression: /new\s+GoogleGenAI\s*\(\s*\{[^}]*\bapiKey\s*:/s },
];

for (const filePath of sourceFiles(sourceRoot)) {
  const source = readFileSync(filePath, 'utf8');
  for (const rule of forbidden) {
    if (rule.expression.test(source)) {
      violations.push(`${relative(root, filePath)}: ${rule.label}`);
    }
  }
}

if (violations.length > 0) {
  console.error('Vertex-only backend guard failed:\n' + violations.map(item => `- ${item}`).join('\n'));
  process.exit(1);
}

console.log('Vertex-only backend guard passed.');
