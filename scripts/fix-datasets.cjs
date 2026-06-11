const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, '../docs/agent-training/datasets');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl'));

let removedCount = 0;

for (const file of files) {
  const filePath = path.join(dir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const goodLines = lines.filter(line => {
    if (!line.trim()) return false;
    try {
      const parsed = JSON.parse(line);
      if (parsed.acceptance_notes === "Auto-generated mock row mapping to HARNESS_TRAINING_PLAN.md") {
        removedCount++;
        return false;
      }
      return true;
    } catch (e) {
      return true;
    }
  });
  
  if (goodLines.length !== lines.filter(l => l.trim()).length) {
    fs.writeFileSync(filePath, goodLines.join('\n') + '\n');
  }
}
console.log(`Removed ${removedCount} bad rows.`);
