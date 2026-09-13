/**
 * Pure checks that keep `docs/wiki/*.md` consistent with the code.
 * `scripts/check-wiki.ts` wires them to the file system.
 */

/** One problem found in a wiki page. */
export interface Finding {
  /** 1-based line number in the page. */
  line: number;
  message: string;
}

/** Repository directories a wiki page may reference by path. */
const PATH_PREFIXES = [
  "src/",
  "src-tauri/",
  "docs/",
  "e2e/",
  "scripts/",
  ".github/",
  ".devcontainer/",
];

/**
 * Extracts repository paths from inline code spans (`` `src/foo/bar.ts` ``).
 * Spans containing placeholders or globs (`<Feature>`, `*`, `{`) are ignored.
 *
 * @param markdown - The page content.
 * @returns The paths found, with the line they appear on. Trailing slashes are removed.
 */
export function extractRepoPaths(markdown: string): { line: number; path: string }[] {
  const found: { line: number; path: string }[] = [];
  markdown.split("\n").forEach((text, index) => {
    for (const match of text.matchAll(/`([^`]+)`/g)) {
      const span = match[1];
      if (/[<*{]/.test(span)) continue;
      if (!PATH_PREFIXES.some((prefix) => span.startsWith(prefix))) continue;
      found.push({ line: index + 1, path: span.replace(/\/$/, "") });
    }
  });
  return found;
}

/**
 * Extracts the script names used in `npm run <name>` anywhere in the page.
 *
 * @param markdown - The page content.
 * @returns The script names with the line they appear on.
 */
export function extractNpmScripts(markdown: string): { line: number; script: string }[] {
  const found: { line: number; script: string }[] = [];
  markdown.split("\n").forEach((text, index) => {
    for (const match of text.matchAll(/npm run ([A-Za-z0-9:_-]+)/g)) {
      found.push({ line: index + 1, script: match[1] });
    }
  });
  return found;
}

/**
 * Collects every string value in a JSON object tree.
 *
 * @param value - The parsed JSON value.
 * @returns All string leaves.
 */
export function collectStrings(value: unknown): Set<string> {
  const out = new Set<string>();
  const visit = (v: unknown): void => {
    if (typeof v === "string") out.add(v);
    else if (v && typeof v === "object") Object.values(v).forEach(visit);
  };
  visit(value);
  return out;
}

/**
 * Reads a dotted path (`reader.comic.cache.preloadPageCount`) from a JSON object tree.
 *
 * @param value - The parsed JSON value.
 * @param dotted - The dotted key path.
 * @returns The value at the path, or `undefined`.
 */
export function getByPath(value: unknown, dotted: string): unknown {
  return dotted.split(".").reduce<unknown>((acc, key) => {
    return acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined;
  }, value);
}

/** Wiki item labels whose "(default N)" is compared with `defaultSettings.json`. */
export const DEFAULT_PATHS: Record<string, string> = {
  "Maximum image height (px)": "reader.rendering.maxImageHeight",
  "PDF rendering height (px)": "reader.rendering.pdfRenderResolutionHeight",
  "Preload page count": "reader.comic.cache.preloadPageCount",
  "Page reader threads": "reader.comic.cache.pageReaderCount",
  "Image cache size (MiB)": "reader.comic.cache.imageCacheSizeMib",
};

/**
 * Checks the "## Settings & Customization" section of the User Guide.
 *
 * Every `### Tab` heading must be a `settings.<tab>.tab-name` value, every `- **Label**` list item
 * must be a string under `settings` in `en-US.json`, and every `(default N)` on an item listed in
 * {@link DEFAULT_PATHS} must equal the value in `defaultSettings.json`.
 *
 * @param markdown - The User Guide content.
 * @param enUs - The parsed `src/i18n/locales/en-US.json`.
 * @param defaults - The parsed `src/features/Settings/defaultSettings.json`.
 * @returns The findings (empty when the section is consistent).
 */
export function checkSettingsSection(
  markdown: string,
  enUs: unknown,
  defaults: unknown,
): Finding[] {
  const findings: Finding[] = [];
  const settings = getByPath(enUs, "settings") as Record<string, unknown> | undefined;
  if (!settings) return [{ line: 1, message: "en-US.json has no `settings` object" }];

  const tabNames = new Set(
    Object.values(settings)
      .map((tab) => getByPath(tab, "tab-name"))
      .filter((name): name is string => typeof name === "string"),
  );
  const strings = collectStrings(settings);

  const lines = markdown.split("\n");
  const start = lines.findIndex((l) => l.startsWith("## Settings & Customization"));
  if (start === -1) return [{ line: 1, message: 'missing "## Settings & Customization" section' }];

  for (let i = start + 1; i < lines.length && !lines[i].startsWith("## "); i++) {
    const text = lines[i];
    const tab = /^### (.+)$/.exec(text);
    if (tab && !tabNames.has(tab[1])) {
      findings.push({ line: i + 1, message: `unknown settings tab "${tab[1]}"` });
      continue;
    }
    const item = /^- \*\*([^*]+)\*\*/.exec(text);
    if (!item) continue;
    const label = item[1];
    if (!strings.has(label)) {
      findings.push({ line: i + 1, message: `"${label}" is not a settings string in en-US.json` });
    }
    const def = /\(default (\d+)/.exec(text);
    const path = DEFAULT_PATHS[label];
    if (def && path) {
      const expected = getByPath(defaults, path);
      if (String(expected) !== def[1]) {
        findings.push({
          line: i + 1,
          message: `"${label}" says default ${def[1]} but ${path} is ${String(expected)}`,
        });
      }
    }
  }
  return findings;
}
