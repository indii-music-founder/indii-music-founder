import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Path to the datasets directory relative to the project root
// packages/renderer/src/test is 4 levels deep from root
const DATASETS_DIR = path.resolve(__dirname, '../../../../docs/agent-training/datasets');

describe('Harness Training Datasets Integrity', () => {
  // Check if directory exists
  if (!fs.existsSync(DATASETS_DIR)) {
    it.skip('Datasets directory not found, skipping tests.', () => {});
    return;
  }

  const files = fs.readdirSync(DATASETS_DIR).filter(f => f.endsWith('.jsonl'));

  it('should find at least one JSONL dataset file', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    describe(`Dataset: ${file}`, () => {
      const filePath = path.join(DATASETS_DIR, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim() !== '');

      it('should parse every line as valid JSON and strictly match the harness schema', () => {
        lines.forEach((line, index) => {
          let parsed;
          try {
            parsed = JSON.parse(line);
          } catch (_e) {
            throw new Error(`Invalid JSON at line ${index + 1} in ${file}`);
          }

          // All records must have input and expected
          expect(parsed).toHaveProperty('input');
          expect(parsed).toHaveProperty('expected');

          // If this is a new Hub-and-Spoke harness record (determined by acceptance_notes or top-level context)
          if (parsed.acceptance_notes) {
            expect(parsed).toHaveProperty('context');
            expect(parsed.context).toHaveProperty('harness_runs');
            expect(parsed.context).toHaveProperty('user_profile');
            expect(parsed.context).toHaveProperty('project_or_release');
            expect(parsed.expected).toHaveProperty('primary_agent');
            expect(parsed.expected).toHaveProperty('structured_output');
          } else {
            // Legacy schema assertions
            expect(parsed).toHaveProperty('agent_id');
            expect(parsed).toHaveProperty('scenario_id');
          }
        });
      });
    });
  }
});
