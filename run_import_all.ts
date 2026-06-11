import { importCookies } from "/Volumes/X SSD 2025/Users/narrowchannel/.claude/skills/gstack/browse/src/cookie-import-browser.ts";
import { writeFileSync } from "fs";

async function main() {
  const result = await importCookies("chrome", [".github.com", "github.com"], "Profile 7");
  writeFileSync("gh_cookies.json", JSON.stringify(result.cookies, null, 2));
  console.log("Written gh_cookies.json");
}
main().catch(console.error);
