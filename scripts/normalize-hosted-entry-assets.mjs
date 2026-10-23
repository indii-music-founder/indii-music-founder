import { readFileSync, writeFileSync } from 'node:fs';

const entry = process.argv[2];
if (!entry) throw new Error('Pass the hosted renderer index.html path.');

const original = readFileSync(entry, 'utf8');
const normalized = original.replace(
  /\b(src|href)=(['"])(?:%BASE_URL%|\.\/|\/)?(bootstrap\.js|assets\/[^'"]+)\2/g,
  (_match, attribute, quote, asset) => `${attribute}=${quote}/${asset}${quote}`,
);

const bootstrap = normalized.match(/\bsrc=['"]\/bootstrap\.js['"]/);
const moduleScript = normalized.match(/\bsrc=['"]\/assets\/[^'"]+\.js['"]/);
if (!bootstrap || !moduleScript) {
  const assetReferences = [...normalized.matchAll(/\b(?:src|href)=['"][^'"]*(?:bootstrap\.js|assets\/)[^'"]*['"]/g)]
    .map(match => match[0]);
  throw new Error(`Hosted entry has unresolved asset paths: ${assetReferences.join(', ')}`);
}

if (normalized !== original) writeFileSync(entry, normalized);
console.log('Hosted entry uses root-based bootstrap and bundle assets.');
