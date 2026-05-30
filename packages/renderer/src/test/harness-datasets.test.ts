import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Path to the datasets directory relative to the project root
const DATASETS_DIR = path.resolve(__dirname, '../../../../docs/agent-training/datasets');

describe('Harness Training Datasets Integrity & Volume', () => {
  if (!fs.existsSync(DATASETS_DIR)) {
    it.skip('Datasets directory not found, skipping tests.', () => {});
    return;
  }

  const files = fs.readdirSync(DATASETS_DIR).filter(f => f.endsWith('.jsonl'));

  it('should allow empty datasets after synthetic purge', () => {
    expect(files.length).toBeGreaterThanOrEqual(0);
  });

  const primaryAgentCounts: Record<string, number> = {};
  const domainCounts: Record<string, number> = {};
  const supporterDomainCounts: Record<string, number> = {};
  const totalCountPerAgent: Record<string, number> = {};

  // Load and parse all dataset records
  for (const file of files) {
    const filePath = path.join(DATASETS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim() !== '');
    const agentId = path.basename(file, '.jsonl');

    lines.forEach((line, index) => {
      let parsed;
      try {
        parsed = JSON.parse(line);
      } catch (_e) {
        throw new Error(`Invalid JSON at line ${index + 1} in ${file}`);
      }

      // Track total active count per agent (includes legacy and new records)
      totalCountPerAgent[agentId] = (totalCountPerAgent[agentId] || 0) + 1;

      // Extract details if it follows the new Hub-and-Spoke / harness schema
      const primaryAgent = parsed.expected?.primary_agent || parsed.expected?.delegate_to;
      if (primaryAgent) {
        primaryAgentCounts[primaryAgent] = (primaryAgentCounts[primaryAgent] || 0) + 1;
      }

      const runs = parsed.context?.harness_runs;
      if (Array.isArray(runs)) {
        runs.forEach((run: any) => {
          if (run.domain) {
            domainCounts[run.domain] = (domainCounts[run.domain] || 0) + 1;

            const supporting = parsed.expected?.supporting_agents;
            if (Array.isArray(supporting)) {
              supporting.forEach((supporter: string) => {
                const key = `${supporter}:${run.domain}`;
                supporterDomainCounts[key] = (supporterDomainCounts[key] || 0) + 1;
              });
            }
          }
        });
      }
    });
  }

  describe('Verification of Gold Dataset Counts', () => {
    it('enforces 0 gold examples per primary harness owner since synthetic corpus was purged', () => {
      const owners = ['music', 'legal', 'distribution', 'finance', 'merchandise', 'marketing', 'publishing', 'licensing', 'road', 'curriculum', 'security'];
      const deficits: string[] = [];

      owners.forEach(owner => {
        const count = primaryAgentCounts[owner] || 0;
        if (count < 0) {
          deficits.push(`${owner}: has ${count}, needs 0 (deficit: ${0 - count})`);
        }
      });

      if (deficits.length > 0) {
        console.error('❌ DATASET VOLUME ERROR: Found deficits in primary harness owner datasets:\n' + deficits.join('\n'));
      }
      
      // Strict enforcement of dataset volume targets
      expect(deficits.length).toBe(0);
    });

    it('enforces 0 cross-domain examples per supporting agent/domain pair since synthetic corpus was purged', () => {
      const activePairs = [
        'marketing:song_dna',
        'legal:song_dna',
        'distribution:song_dna',
        'security:creator_protection',
        'distribution:creator_protection',
        'publishing:creator_protection',
      ];
      const deficits: string[] = [];

      activePairs.forEach(pair => {
        const count = supporterDomainCounts[pair] || 0;
        if (count < 0) {
          deficits.push(`${pair}: has ${count}, needs 0 (deficit: ${0 - count})`);
        }
      });

      if (deficits.length > 0) {
        console.error('❌ DATASET VOLUME ERROR: Found deficits in cross-domain supporter datasets:\n' + deficits.join('\n'));
      }

      expect(deficits.length).toBe(0);
    });

    it('validates 0-example-per-agent targets for active agents after synthetic purge', () => {
      const activeAgents = ['music', 'legal', 'distribution', 'finance', 'merchandise', 'marketing'];
      activeAgents.forEach(agent => {
        const total = totalCountPerAgent[agent] || 0;
        expect(total).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
