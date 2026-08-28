const fs = require('fs');
const path = require('path');

const workflows = ['start.md', 'middle.md', 'end.md', 'go.md', 'proceed.md'];
const workflowDir = '/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indii-music-founder/.agent/workflows';

workflows.forEach(file => {
  const filePath = path.join(workflowDir, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes('## Elevate and Polish (The `/better` Audit)')) {
      const appendText = `

## Elevate and Polish (The \`/better\` Audit)
At the conclusion of this workflow, automatically execute the \`/better\` workflow to:
1. Audit the changes and additions from every angle (Performance, DevEx, Architecture).
2. Elevate the codebase to Platinum Quality Standards.
3. Apply any necessary micro-refactors or polish before proceeding.
`;
      fs.appendFileSync(filePath, appendText);
      console.log(`Appended /better to ${file}`);
    } else {
      console.log(`${file} already has /better`);
    }
  }
});
