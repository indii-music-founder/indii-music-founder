
try {
    const fb = require('@genkit-ai/firebase');
    console.log('--- @genkit-ai/firebase ---');
    console.log('Version:', require('@genkit-ai/firebase/package.json').version);
    console.log('Exports:', Object.keys(fb));
    console.log('Default:', fb.default);

    const google = require('@genkit-ai/googleai');
    console.log('\n--- @genkit-ai/googleai ---');
    console.log('Version:', require('@genkit-ai/googleai/package.json').version);
    console.log('Exports:', Object.keys(google));

    const genkit = require('genkit');
    console.log('\n--- genkit ---');
    console.log('Version:', require('genkit/package.json').version);
    console.log('Exports:', Object.keys(genkit));

} catch (e) {
    console.error(e);
}
