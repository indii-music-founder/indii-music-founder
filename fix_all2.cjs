const fs = require('fs');
const files = Object.keys(require('./parsed_placeholders.json'));

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('const { t } = useTranslation();')) {
      // Find the component function declaration line by searching for the first export function/const that has JSX or just inject at the top of the function
      let lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
          if ((lines[i].includes('export function ') || lines[i].includes('export const ') || lines[i].includes('const ') && lines[i].includes('React.FC')) && (lines[i].includes('=> {') || lines[i].includes(') {'))) {
              lines[i] = lines[i].replace(/=>\s*\{|\)\s*\{/, match => match + '\n    const { t } = useTranslation();');
              break;
          }
      }
      fs.writeFileSync(file, lines.join('\n'));
      console.log('Fixed ' + file);
  }
}
