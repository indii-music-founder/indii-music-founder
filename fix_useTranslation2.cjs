const fs = require('fs');
const files = Object.keys(require('./parsed_placeholders.json'));

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('const { t } = useTranslation();')) {
    // Look for `export function ComponentName` or `const ComponentName = (`
    // and inject after the first `{`
    const regex = /(export\s+function\s+[A-Z]\w*<[^>]+>\s*\([^)]*\)[^{]*\{|export\s+function\s+[A-Z]\w*\s*\([^)]*\)[^{]*\{|const\s+[A-Z]\w*\s*=\s*\([^)]*\)[^{]*=>\s*\{|export\s+const\s+[A-Z]\w*\s*=\s*\([^)]*\)[^{]*=>\s*\{)/;
    
    const match = content.match(regex);
    if (match) {
        content = content.replace(regex, match[0] + "\n    const { t } = useTranslation();");
        fs.writeFileSync(file, content);
        console.log(`Injected useTranslation into ${file}`);
    } else {
        console.log(`Could not find component in ${file}`);
    }
  }
}
