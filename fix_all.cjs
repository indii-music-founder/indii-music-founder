const fs = require('fs');

const files = Object.keys(require('./parsed_placeholders.json'));

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('const { t } = useTranslation();')) {
      // Find export function Component(...) { OR const Component = (...) => {
      content = content.replace(/(export\s+function\s+[A-Z]\w*(?:<[^>]+>)?\s*\([^)]*\)\s*\{|const\s+[A-Z]\w*\s*=\s*\([^)]*\)\s*=>\s*\{|export\s+const\s+[A-Z]\w*\s*=\s*\([^)]*\)\s*=>\s*\{)/, (match) => {
          return match + '\n    const { t } = useTranslation();';
      });
      fs.writeFileSync(file, content);
      console.log('Injected in ' + file);
  }
}
