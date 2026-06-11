import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FLOWCHARTS_DIR = path.resolve(__dirname, '../docs/flowcharts');

console.log(`[Flowcharts Validator] Scanning directory: ${FLOWCHARTS_DIR}`);

if (!fs.existsSync(FLOWCHARTS_DIR)) {
  console.log('✅ No flowcharts directory found. Skipping check.');
  process.exit(0);
}

const files = fs.readdirSync(FLOWCHARTS_DIR).filter(file => file.endsWith('.md'));

if (files.length === 0) {
  console.log('✅ No flowcharts found. Skipping check.');
  process.exit(0);
}

let overallFail = false;

for (const file of files) {
  const filePath = path.join(FLOWCHARTS_DIR, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  console.log(`Analyzing: ${file}...`);
  let hasH1 = false;
  let hasMermaid = false;
  let hasBreakdown = false;
  let inMermaid = false;
  let errors = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    // 1. Check for H1 Header
    if (line.startsWith('# ')) {
      hasH1 = true;
    }

    // 2. Track Mermaid boundaries and validate contents
    if (line.startsWith('```mermaid')) {
      hasMermaid = true;
      inMermaid = true;
      continue;
    }

    if (line.startsWith('```') && inMermaid) {
      inMermaid = false;
      continue;
    }

    if (inMermaid) {
      // Check for illegal HTML tags inside Mermaid that crash the renderer
      if (/<(br|b|span|div|p|h[1-6]|strong|em)>/i.test(line)) {
        errors.push(`Line ${lineNum}: Found crash-prone HTML tags in Mermaid label ("${line}"). Use plain text instead.`);
      }

      // Check for unquoted parenthesis or brackets in labels that cause syntax crashes
      // Matches nodes like: id(Text) or id[Text] instead of id["Text"] or id("Text")
      // Specifically target node structures: variable[label] or variable(label) where label doesn't start with quote
      const unquotedLabelMatch = /^[a-zA-Z0-9_-]+\s*([\[\(])([^"'].*?)([\]\)])/.exec(line);
      if (unquotedLabelMatch) {
        errors.push(`Line ${lineNum}: Unquoted special characters/labels in node definition ("${line}"). Enclose labels in quotes: id["Label Text"]`);
      }
    }

    // 3. Check for transition breakdown section
    if (line.startsWith('## ') && (/transition/i.test(line) || /step-by-step/i.test(line) || /breakdown/i.test(line))) {
      hasBreakdown = true;
    }
  }

  // Final sanity gates
  if (!hasH1) {
    errors.push('Missing H1 Markdown header title (e.g. "# Release Flowchart")');
  }
  if (!hasMermaid) {
    errors.push('Missing "```mermaid" block diagram');
  }
  if (!hasBreakdown) {
    errors.push('Missing "## Step-by-Step Transition Breakdown" or "## Transition Breakdown" section');
  }

  if (errors.length > 0) {
    console.error(`❌ Validation FAILED for ${file}:`);
    errors.forEach(err => console.error(`   - ${err}`));
    overallFail = true;
  } else {
    console.log(`   ✅ Sanity check passed.`);
  }
}

if (overallFail) {
  console.error('\n❌ Flowchart syntax validation failed. Fix the issues before committing/pushing.');
  process.exit(1);
} else {
  console.log('\n✅ All flowcharts are fully compliant with indii visual quality standards.');
  process.exit(0);
}
