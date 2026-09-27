import { describe, expect, it } from "vitest";
import { checkSettingsSection, extractNpmScripts, extractRepoPaths } from "./wiki-checks";

describe("extractRepoPaths", () => {
  it("returns prefixed paths from code spans and strips trailing slashes", () => {
    const md = "See `src/store/store.ts` and `src-tauri/src/page/`.\nNot `page/cache.rs`.";
    expect(extractRepoPaths(md)).toEqual([
      { line: 1, path: "src/store/store.ts" },
      { line: 1, path: "src-tauri/src/page" },
    ]);
  });

  it("ignores placeholders and globs", () => {
    expect(extractRepoPaths("`src/features/<Feature>/` `src/bindings/*Commands.ts`")).toEqual([]);
  });
});

describe("extractNpmScripts", () => {
  it("finds every npm run invocation with its line", () => {
    expect(extractNpmScripts("Run `npm run check`.\n`npm run gen:bindings:check`")).toEqual([
      { line: 1, script: "check" },
      { line: 2, script: "gen:bindings:check" },
    ]);
  });
});

describe("checkSettingsSection", () => {
  const enUs = {
    settings: {
      general: { "tab-name": "General", theme: { title: "Theme" } },
      rendering: {
        "tab-name": "Rendering & Performance",
        cache: { "preload-page-count": { title: "Preload page count" } },
      },
    },
  };
  const defaults = { reader: { comic: { cache: { preloadPageCount: 10 } } } };
  const page = (body: string) =>
    `## Basic\n\n## Settings & Customization\n${body}\n## Next\n- **Not checked**`;

  it("accepts known tabs, labels and defaults", () => {
    const md = page(
      "### General\n- **Theme**: x\n### Rendering & Performance\n- **Preload page count** (default 10).",
    );
    expect(checkSettingsSection(md, enUs, defaults)).toEqual([]);
  });

  it("reports an unknown tab, an unknown label and a wrong default", () => {
    const md = page("### Rendering\n- **Colour**: x\n- **Preload page count** (default 5).");
    expect(checkSettingsSection(md, enUs, defaults).map((f) => f.message)).toEqual([
      'unknown settings tab "Rendering"',
      '"Colour" is not a settings string in en-US.json',
      '"Preload page count" says default 5 but reader.comic.cache.preloadPageCount is 10',
    ]);
  });

  it("only checks the Settings section", () => {
    expect(checkSettingsSection(page("### General"), enUs, defaults)).toEqual([]);
  });

  it("reports a missing Settings section", () => {
    expect(checkSettingsSection("## Basic", enUs, defaults)).toEqual([
      { line: 1, message: 'missing "## Settings & Customization" section' },
    ]);
  });
});
