const fs = require('fs');
const path = require('path');

const dir = '.agent/workflows/';
const files = fs.readdirSync(dir).filter(f => f.startsWith('live_test_'));

const tests = files.map(file => {
  const content = fs.readFileSync(path.join(dir, file), 'utf8');
  const agentNameMatch = content.match(/# Live Test: (.*)/);
  const agentName = agentNameMatch ? agentNameMatch[1].trim() : '';

  const triggerMatch = content.match(/## 2\. Trigger\n\n\* (.*?)\n/s);
  const trigger = triggerMatch ? triggerMatch[1].trim() : '';
  
  // Clean up trigger text (remove "Request ", "Ask the agent to ", etc)
  let cleanedTrigger = trigger;

  return {
    file,
    agentName,
    trigger: cleanedTrigger
  };
});

console.log(JSON.stringify(tests, null, 2));
