const fs = require('fs');
const files = Object.keys(require('./parsed_placeholders.json'));

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('const { t } = useTranslation();')) {
    // Find the first occurrence of `export function ` followed by capital letter
    // Or `export const ` followed by capital letter
    let lines = content.split('\n');
    let injected = false;
    for (let i = 0; i < lines.length; i++) {
        if ((lines[i].includes('export function') || lines[i].includes('export const ') || lines[i].includes('export default function')) && /[A-Z]/.test(lines[i])) {
            // Wait until we see the opening brace `{` of the component
            let j = i;
            while (j < lines.length && !lines[j].includes('{')) {
                j++;
            }
            if (j < lines.length) {
                // If the '{' is on line j, inject on line j+1
                // Actually wait, let's just insert it after the first `{` on line j
                lines[j] = lines[j].replace('{', '{\n    const { t } = useTranslation();');
                injected = true;
                break;
            }
        }
    }
    
    if (injected) {
        fs.writeFileSync(file, lines.join('\n'));
        console.log(`Injected into ${file}`);
    } else {
        console.log(`Still failed: ${file}`);
    }
  }
}
