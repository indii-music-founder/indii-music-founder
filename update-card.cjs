const fs = require('fs');
const path = 'packages/renderer/src/components/ui/card.tsx';
let content = fs.readFileSync(path, 'utf8');

// The original class is: "rounded-xl border bg-card text-card-foreground shadow"
// We want to replace it with a sleek glassmorphic class.
const oldClass = "rounded-xl border bg-card text-card-foreground shadow";
const newClass = "rounded-xl border border-white/10 bg-surface/30 backdrop-blur-xl text-card-foreground shadow-xl shadow-black/20";

if (content.includes(oldClass)) {
    content = content.replace(oldClass, newClass);
    fs.writeFileSync(path, content);
    console.log("Updated Card component to be glassmorphic.");
} else {
    console.log("Card component already updated or not found.");
}
