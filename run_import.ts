import { importCookies } from "/Volumes/X SSD 2025/Users/narrowchannel/.claude/skills/gstack/browse/src/cookie-import-browser.ts";
import { BrowserSessionManager } from "/Volumes/X SSD 2025/Users/narrowchannel/.claude/skills/gstack/browse/src/browser-manager.ts";

async function main() {
  const result = await importCookies("chrome", [".github.com", "github.com"], "Profile 7");
  console.log("Imported:", result.count);
  console.log(JSON.stringify(result.cookies.filter(c => c.name.includes("session"))));
}
main().catch(console.error);
