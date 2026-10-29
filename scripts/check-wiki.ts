import { existsSync, readdirSync, readFileSync } from "node:fs";
import * as path from "node:path";
import {
  checkSettingsSection,
  extractNpmScripts,
  extractRepoPaths,
  type Finding,
} from "./wiki-checks";

const root = process.cwd();
const wikiDir = path.join(root, "docs", "wiki");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf-8"));
const enUs = JSON.parse(readFileSync(path.join(root, "src/i18n/locales/en-US.json"), "utf-8"));
// Read as text: importing `bindings.ts` would pull it into the composite node project,
// which the root tsconfig references, and break the root type check.
const bindings = readFileSync(path.join(root, "src/bindings/bindings.ts"), "utf-8");
const defaultsJson = /^export const DEFAULT_SETTINGS = (.*) as const;$/m.exec(bindings)?.[1];
if (defaultsJson === undefined) {
  console.error("[Error] DEFAULT_SETTINGS not found in src/bindings/bindings.ts.");
  process.exit(1);
}
const defaults = JSON.parse(defaultsJson);
const scripts = new Set(Object.keys(pkg.scripts ?? {}));

let total = 0;
for (const file of readdirSync(wikiDir)
  .filter((f) => f.endsWith(".md"))
  .sort()) {
  const markdown = readFileSync(path.join(wikiDir, file), "utf-8");
  const findings: Finding[] = [];

  for (const { line, path: p } of extractRepoPaths(markdown)) {
    if (!existsSync(path.join(root, p))) findings.push({ line, message: `path not found: ${p}` });
  }
  for (const { line, script } of extractNpmScripts(markdown)) {
    if (!scripts.has(script)) findings.push({ line, message: `npm script not found: ${script}` });
  }
  if (file === "User-Guide.md") findings.push(...checkSettingsSection(markdown, enUs, defaults));

  for (const f of findings) console.error(`docs/wiki/${file}:${f.line}: ${f.message}`);
  total += findings.length;
}

if (total > 0) {
  console.error(`[Error] ${total} wiki inconsistenc${total === 1 ? "y" : "ies"} found.`);
  process.exit(1);
}
console.log("[Info] Wiki pages are consistent with the code.");
