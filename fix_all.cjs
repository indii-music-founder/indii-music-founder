const fs = require('fs');

function replaceFile(path, search, replace) {
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace(search, replace);
  fs.writeFileSync(path, content);
}

replaceFile('docs/business-decisions/03_REVENUE_AND_PRICING.md', '10 seats total', '11 total Founder seats (Founder #1 reserved/internal and 10 paid seats available)');
replaceFile('packages/landing/src/components/FoundersSection.tsx', '10 seats maximum', '11 total seats (10 paid)');
replaceFile('packages/landing/src/components/FoundersSection.tsx', '10 seats total', '11 total seats');
replaceFile('packages/landing/src/page.tsx', '10 seats', '11 total seats');
replaceFile('packages/renderer/src/modules/founders/FoundersCheckout.test.tsx', '10 Seats Maximum', '11 Total Seats');

