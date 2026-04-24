import { promises as fs } from "node:fs";
import * as path from "node:path";

/**
 * Reads the current version from tauri.conf.json or package.json as a fallback.
 * @param cwd Current working directory.
 * @returns The version string.
 */
async function getProjectVersion(cwd: string): Promise<string> {
  const tauriConfigPath = path.join(cwd, "src-tauri", "tauri.conf.json");

  try {
    const content = await fs.readFile(tauriConfigPath, "utf-8");
    const config = JSON.parse(content);

    if (typeof config.version === "string" && config.version) {
      return config.version;
    }
  } catch (error) {
    console.error("[Error] Could not find version in tauri.conf.json", error);
  }

  // Fallback to package.json if tauri.conf.json is missing or doesn't have a version
  try {
    const pkgPath = path.join(cwd, "package.json");
    const pkgContent = await fs.readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(pkgContent);
    if (!pkg.version) throw new Error("No version in package.json");
    return pkg.version;
  } catch (error) {
    console.error("[Error] Could not find version in package.json", error);
    process.exit(1);
  }
}

/**
 * Extracts the changelog content for a specific version from the given CHANGELOG.md file.
 * @param filePath The path to the CHANGELOG.md file.
 * @param version The version to extract (e.g., '2.0.2', 'v2.0.2').
 * @returns The extracted Markdown text (empty string if not found).
 */
async function extractVersionContent(filePath: string, version: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split("\n");

    // Remove the 'v' prefix if present to match the standard format like [2.0.2]
    const cleanVersion = version.replace(/^v/, "");
    const versionHeader = `## [${cleanVersion}]`;

    let isCapturing = false;
    const capturedLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith("## [")) {
        if (line.startsWith(versionHeader)) {
          isCapturing = true;
          continue; // Skip the version header line itself
        } else if (isCapturing) {
          break; // Stop capturing as the next version section has been reached
        }
      }

      if (isCapturing) {
        capturedLines.push(line);
      }
    }

    // Remove unnecessary leading and trailing whitespace/newlines
    return capturedLines.join("\n").trim();
  } catch (error) {
    console.error(`[Error] Failed to read or parse ${filePath}:`, error);
    return "";
  }
}

async function main(): Promise<void> {
  const cwd = process.cwd();
  const version = await getProjectVersion(cwd);
  console.log(`[Info] Auto-detected version: ${version}`);

  const enFilePath = path.join(cwd, "CHANGELOG.md");
  const jaFilePath = path.join(cwd, "docs/ja_JP/CHANGELOG.md");

  // Read both changelog files in parallel
  const [enContent, jaContent] = await Promise.all([
    extractVersionContent(enFilePath, version),
    extractVersionContent(jaFilePath, version),
  ]);

  if (!enContent && !jaContent) {
    console.error(`[Error] No changelog entries found for version ${version} in either file.`);
    process.exit(1);
  }

  // Build the output format
  const releaseBody = [
    "## English",
    "",
    enContent || "No English changelog available for this version.",
    "",
    "---",
    "",
    "## 日本語",
    "",
    jaContent || "日本語の変更履歴はありません。",
  ].join("\n");

  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    const delimiter = `EOF_RELEASE_BODY_${Date.now()}`;
    const outputContent = `RELEASE_BODY<<${delimiter}\n${releaseBody}\n${delimiter}\n`;

    await fs.appendFile(githubOutput, outputContent, "utf-8");
    console.log("[Info] Successfully wrote RELEASE_BODY to GITHUB_OUTPUT");
  } else {
    console.log("[Warning] GITHUB_OUTPUT environment variable not found (Skipping CI output)");
  }

  console.log(`Successfully generated release body for ${version}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
