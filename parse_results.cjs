const fs = require('fs');
const results = JSON.parse(fs.readFileSync('e2e_results.json', 'utf8'));

const suites = results.suites[0].suites[0].specs;
const out = [];
let issueCounter = 100; // start at 100 or find max in OPEN_ISSUES

suites.forEach(spec => {
  const name = spec.title.replace('Live Test: ', '');
  const result = spec.tests[0].results[0];
  const status = result.status; // passed, failed, timedOut
  let verdict = status === 'passed' ? '✅ PASS' : (status === 'failed' ? '❌ FAIL' : '⚠️ PARTIAL');
  
  const stdout = result.stdout ? result.stdout.map(s => s.text).join('') : '';
  const isPartial = stdout.includes('[PARTIAL]');
  if (isPartial && status === 'passed') verdict = '⚠️ PARTIAL';
  if (isPartial && status === 'failed') verdict = '❌ FAIL';

  const errors = result.error ? result.error.message : '';
  let reason = stdout.split('\n').filter(l => l.includes('Error') || l.includes('failed')).slice(0,2).join('; ');
  if (!reason && errors) reason = errors.split('\n')[0];
  if (!reason && isPartial) reason = "Module loaded but trigger could not be automatically executed (no input found).";
  if (!reason && status === 'passed') reason = "No errors detected. Operations completed.";

  out.push({
    name,
    verdict,
    duration: Math.round(result.duration / 1000) + 's',
    reason,
    errors
  });
});

console.log(JSON.stringify(out, null, 2));
