const fs = require('fs');
const glob = require('glob');

const files = glob.sync('packages/{renderer,main,firebase}/src/**/*.ts');

files.forEach(file => {
  if (file.includes('.test.ts') || file.includes('__tests__') || file.includes('EvolutionaryLoop') || file.includes('Helix') || file.includes('naturalFallback')) {
    return;
  }
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Pattern 1: Math.random().toString(36).substr(2, 9) or substring
  const p1 = /Math\.random\(\)\.toString\(36\)\.sub(?:str|string)\(\d+(?:,\s*\d+)?\)/g;
  if (p1.test(content)) {
    content = content.replace(p1, "crypto.randomUUID().split('-')[0]");
    changed = true;
  }
  
  // Pattern 2: Math.random() alone in cost_mileage id string
  const p2 = /id: `cost_mileage_\$\{Date\.now\(\)\}_\$\{Math\.random\(\)\}`/g;
  if (p2.test(content)) {
    content = content.replace(p2, "id: `cost_mileage_${Date.now()}_${crypto.randomUUID().split('-')[0]}`");
    changed = true;
  }

  // Pattern 3: Math.floor(Math.random() * 1000) for ID
  const p3 = /auditLogId: `audit_\$\{Date\.now\(\)\}_\$\{Math\.floor\(Math\.random\(\) \* 1000\)\}`/g;
  if (p3.test(content)) {
    content = content.replace(p3, "auditLogId: `audit_${Date.now()}_${crypto.randomUUID().split('-')[0]}`");
    changed = true;
  }
  
  // Pattern 4: main.ts password
  const p4 = /const password = Math\.floor\(100000 \+ Math\.random\(\) \* 900000\)\.toString\(\);/g;
  if (p4.test(content)) {
    content = content.replace(p4, "const password = crypto.randomUUID().substring(0, 6);");
    changed = true;
  }
  
  // Pattern 5: Firebase analytics hash
  const p5 = /const hash = Math\.random\(\)\.toString\(36\)\.substr\(2, 9\);/g;
  if (p5.test(content)) {
    content = content.replace(p5, "const hash = crypto.randomUUID().split('-')[0];");
    changed = true;
  }

  // Pattern 6: RequestTracingService random
  const p6 = /const random = Math\.random\(\)\.toString\(36\)\.substr\(2, 9\);/g;
  if (p6.test(content)) {
    content = content.replace(p6, "const random = crypto.randomUUID().split('-')[0];");
    changed = true;
  }
  
  // Let's just catch all general Math.random().toString(36)
  const p7 = /\$\{Math\.random\(\)\.toString\(36\)\.slice\(\d+(?:,\s*\d+)?\)\}/g;
  if (p7.test(content)) {
    content = content.replace(p7, "${crypto.randomUUID().split('-')[0]}");
    changed = true;
  }
  
  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed', file);
  }
});
