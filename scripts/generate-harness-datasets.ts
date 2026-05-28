import fs from 'fs';
import path from 'path';

// Target datasets path
const DATASETS_DIR = path.resolve(process.cwd(), 'docs/agent-training/datasets');

// Configuration based on HARNESS_TRAINING_PLAN.md
const DOMAINS = [
  {
    primary: 'legal',
    supporting: ['distribution', 'merchandise', 'brand'],
    scenarios: [
      "User reports an AI voice clone song",
      "User reports explicit deepfake imagery",
      "Contract grants perpetual AI likeness training rights",
      "Tracking NO FAKES Act vs Tennessee ELVIS Act"
    ],
    primaryCount: 50,
    supportingCount: 10
  },
  {
    primary: 'security',
    supporting: ['devops', 'generalist'],
    scenarios: [
      "Evidence packet integrity verification",
      "User requests acoustic fingerprinting without explicit opt-in",
      "Fraud and impersonation escalation detected"
    ],
    primaryCount: 25,
    supportingCount: 10
  },
  {
    primary: 'distribution',
    supporting: ['publishing', 'music'],
    scenarios: [
      "User wants to upload a release with missing ISWC and no split sheet",
      "DDEX readiness check failed",
      "AI disclosure enforcement before DSP delivery"
    ],
    primaryCount: 25,
    supportingCount: 10
  },
  {
    primary: 'finance',
    supporting: ['road', 'merchandise', 'marketing'],
    scenarios: [
      "User asks Boardroom to launch merch and paid ads with no budget",
      "User drives to buy guitar strings for a session",
      "Time-value accounting vs real revenue calculation"
    ],
    primaryCount: 25,
    supportingCount: 10
  },
  {
    primary: 'road',
    supporting: ['finance', 'merchandise'],
    scenarios: [
      "User drives to buy guitar strings for a session",
      "Tour route planning and per diem calculation",
      "Equipment supply runs tied to specific projects"
    ],
    primaryCount: 25,
    supportingCount: 10
  },
  {
    primary: 'merchandise',
    supporting: ['finance', 'brand'],
    scenarios: [
      "POD provider comparison and SKU margin planning",
      "Artwork likeness checks for tour merch bundles",
      "User asks Boardroom to launch merch and paid ads with no budget"
    ],
    primaryCount: 25,
    supportingCount: 10
  },
  {
    primary: 'generalist', // Conductor / Boardroom
    supporting: [],
    scenarios: [
      "User asks Boardroom to launch merch and paid ads with no budget",
      "Resolving conflict between Release and Merch schedules",
      "Blocked harness gates override marketing urgency"
    ],
    primaryCount: 25,
    supportingCount: 0
  }
];

function generateExample(scenario: string, primaryAgent: string, isSupporting: boolean = false) {
  return JSON.stringify({
    input: {
      user_message: scenario
    },
    context: {
      harness_runs: [
        {
          id: `run_${Math.random().toString(36).substr(2, 9)}`,
          status: isSupporting ? "supporting_review" : "primary_evaluation"
        }
      ],
      user_profile: {
        role: "artist",
        verification_status: "verified"
      },
      project_or_release: {
        id: `proj_${Math.random().toString(36).substr(2, 9)}`,
        status: "draft"
      }
    },
    expected: {
      primary_agent: primaryAgent,
      supporting_agents: isSupporting ? [] : ["boardroom"],
      tools_called: ["evaluate_harness", "check_compliance"],
      structured_output: {
        decision: isSupporting ? "escalate" : "block",
        reason: "Harness gate enforcement based on scenario rules."
      },
      refusal_or_escalation: isSupporting ? "Escalating to Boardroom." : "Action blocked due to missing approvals or compliance flags."
    },
    acceptance_notes: "Auto-generated mock row mapping to HARNESS_TRAINING_PLAN.md"
  });
}

function appendToDataset(fileName: string, data: string[]) {
  const filePath = path.join(DATASETS_DIR, `${fileName}.jsonl`);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '');
  }
  fs.appendFileSync(filePath, '\n' + data.join('\n') + '\n');
}

async function main() {
  console.log('Starting dataset generation for Harness Training Plan...');

  for (const domain of DOMAINS) {
    console.log(`Processing domain: ${domain.primary}...`);
    
    // Generate primary examples
    const primaryExamples = [];
    for (let i = 0; i < domain.primaryCount; i++) {
      const scenario = domain.scenarios[i % domain.scenarios.length];
      primaryExamples.push(generateExample(scenario, domain.primary));
    }
    appendToDataset(domain.primary, primaryExamples);
    console.log(`  -> Appended ${domain.primaryCount} primary examples to ${domain.primary}.jsonl`);

    // Generate supporting examples
    for (const supporting of domain.supporting) {
      const supportingExamples = [];
      for (let i = 0; i < domain.supportingCount; i++) {
        const scenario = domain.scenarios[i % domain.scenarios.length];
        supportingExamples.push(generateExample(scenario, domain.primary, true));
      }
      appendToDataset(supporting, supportingExamples);
      console.log(`  -> Appended ${domain.supportingCount} cross-domain examples to ${supporting}.jsonl`);
    }
  }

  console.log('\\nDataset setup complete!');
}

main().catch(console.error);
