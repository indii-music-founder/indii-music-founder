const fs = require('fs');
const { execSync } = require('child_process');

const agents = ['brand', 'marketing', 'distribution', 'legal', 'generalist', 'finance'];

for (const agent of agents) {
    console.log(`Fixing ${agent}...`);
    const file = `${agent}_train.jsonl`;
    const gcsUri = `gs://indii-training-data/ft_export/r8/${file}`;
    
    // Download
    execSync(`gsutil cp ${gcsUri} .`);
    
    const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
    const validLines = lines.filter((line, i) => {
        try {
            const d = JSON.parse(line);
            if (!d.systemInstruction?.parts?.[0]?.text) return false;
            let valid = true;
            d.contents.forEach(c => {
                if (!c.parts || c.parts.length === 0 || !c.parts[0].text || c.parts[0].text.trim() === '') {
                    valid = false;
                }
            });
            return valid;
        } catch (e) {
            return false;
        }
    });
    
    fs.writeFileSync(`fixed_${file}`, validLines.join('\n') + '\n');
    console.log(`  Filtered out ${lines.length - validLines.length} invalid lines.`);
    
    // Upload back
    execSync(`gsutil cp fixed_${file} ${gcsUri}`);
    
    // Cleanup
    fs.unlinkSync(file);
    fs.unlinkSync(`fixed_${file}`);
}
console.log('All fixed!');
