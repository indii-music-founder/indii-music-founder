const fs = require('fs');

const files = Object.keys(require('./parsed_placeholders.json'));

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  if (!content.includes('useTranslation();') && !content.includes('useTranslation(')) {
    // We need to inject const { t } = useTranslation();
    
    // Find where the main component starts. Usually `export function ComponentName(` or `const ComponentName = (`
    const componentRegex = /(export\s+function\s+[A-Z]\w*\s*\([^)]*\)\s*\{|export\s+const\s+[A-Z]\w*\s*=\s*\([^)]*\)\s*=>\s*\{|const\s+[A-Z]\w*\s*=\s*\([^)]*\)\s*=>\s*\{)/g;
    
    // We will replace the first match of a component that returns JSX.
    // Instead of parsing, we can just replace all component signatures with the signature + `\n    const { t } = useTranslation();`
    // but only if it's a React component (starts with uppercase).
    
    let replaced = false;
    content = content.replace(componentRegex, (match) => {
      replaced = true;
      return match + "\n    const { t } = useTranslation();";
    });
    
    if (replaced) {
      fs.writeFileSync(file, content);
      console.log(`Injected useTranslation into ${file}`);
    } else {
      console.log(`Could not find component in ${file}`);
    }
  }
}
