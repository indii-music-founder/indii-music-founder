import packageJson from '../package.json' with { type: 'json' };
const scripts = ['deploy', 'deploy:functions', 'deploy:landing', 'deploy:all'];
const missing = scripts.filter((name) => !packageJson.scripts[name]?.startsWith('npm run repo:assert-canonical &&'));
if (missing.length) throw new Error(`Missing canonical guards: ${missing.join(', ')}`);
console.log(`Verified canonical-repository guards on ${scripts.length} production deploy scripts.`);
