const fs = require('fs');
let content = fs.readFileSync('docs/FOUNDERS_PLAN.md', 'utf8');

content = content.replace('10 seats, lifetime', '11 total seats, lifetime');
content = content.replace('10 seats, lifetime access', '11 total seats (10 paid), lifetime access');
content = content.replace('10 seats, Lifetime', '11 seats, Lifetime');
content = content.replace('Exactly 10 founders total. No exceptions.', '11 total Founder seats (Founder #1 reserved/internal and 10 paid seats available).');
content = content.replace('"10 seats" counter', '"11 seats" counter');
content = content.replace('seats_total: 10,', 'seats_total: 11,');
content = content.replace('1–10, permanent', '1–11, permanent');
content = content.replace('count < 10 atomically', 'count < 11 atomically');
content = content.replace('"10 Founding Seats"', '"11 Total Seats"');

fs.writeFileSync('docs/FOUNDERS_PLAN.md', content);
