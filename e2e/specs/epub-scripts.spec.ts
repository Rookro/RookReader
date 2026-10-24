import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { $, browser, expect } from "@wdio/globals";
import { packEpub } from "../fixtures/packEpub";

describe("RookReader E2E Tests - EPUB scripts", () => {
  const epubPath = path.join(
    mkdtempSync(path.join(os.tmpdir(), "rookreader-epub-")),
    "scripted.epub",
  );

  before(async () => {
    await packEpub(path.join(process.cwd(), "e2e", "fixtures", "scripted_epub"), epubPath, {
      "OEBPS/font.woff2": path.join(
        process.cwd(),
        "src",
        "assets",
        "fonts",
        "NotoSerifJP-VariableFont_wght.woff2",
      ),
    });
  });

  it("does not run scripts inside an EPUB", async () => {
    const bookshelf = $('[data-testid="bookshelf"]');
    if (await bookshelf.isDisplayed()) {
      const returnToReaderButton = $('button[aria-label="book-reader"]');
      await returnToReaderButton.waitForClickable();
      await returnToReaderButton.click();
    }

    // Violations of the app's own policy on the main document mean the policy blocks
    // something the app needs.
    await browser.execute(() => {
      const violations: string[] = [];
      Object.assign(window, { cspViolations: violations });
      document.addEventListener("securitypolicyviolation", (e) => {
        violations.push(`${e.violatedDirective} ${e.blockedURI}`);
      });
    });

    const pathInput = $('input[aria-label="container-path-input"]');
    await pathInput.waitForDisplayed();
    // Submit the form directly, as page-navigation.spec.ts does: the embedded WebDriver
    // provider cannot reliably submit through the Enter key.
    await pathInput.setValue(epubPath);
    await browser.execute(() => {
      document
        .querySelector<HTMLInputElement>('input[aria-label="container-path-input"]')
        ?.form?.requestSubmit();
    });

    await browser.waitUntil(
      () =>
        browser.execute(() => {
          type Renderer = { getContents(): { doc: Document }[] };
          const view = document.querySelector("foliate-view") as
            | (Element & { renderer?: Renderer })
            | null;
          return (
            view?.renderer
              ?.getContents()[0]
              ?.doc.body.textContent?.includes("SCRIPT-TEST-CHAPTER") ?? false
          );
        }),
      { timeout: 15000, timeoutMsg: "the scripted chapter never rendered" },
    );
    // Give the toggle handler and the external script time to fire.
    await browser.pause(1000);

    const marker = await browser.execute(() =>
      document.documentElement.getAttribute("data-epub-script"),
    );
    expect(marker).toBeNull();

    const violations = await browser.execute(
      () => (window as unknown as { cspViolations: string[] }).cspViolations,
    );
    expect(violations).toEqual([]);
  });

  // Runs on the book the previous test opened: the policies must not block the book's
  // own images and fonts.
  it("still loads the images and fonts inside an EPUB", async () => {
    await browser.execute(() => {
      type Renderer = { getContents(): { doc: Document }[] };
      const view = document.querySelector("foliate-view") as Element & { renderer: Renderer };
      const doc = view.renderer.getContents()[0].doc;
      const result: { image?: boolean; font?: boolean } = {};
      Object.assign(window, { epubResources: result });
      const image = doc.getElementById("embedded-image") as HTMLImageElement;
      const settle = () => {
        result.image = image.naturalWidth > 0;
      };
      if (image.complete) settle();
      else image.addEventListener("load", settle);
      image.addEventListener("error", () => {
        result.image = false;
      });
      doc.fonts.load('16px "EmbeddedTest"').then(
        (faces) => {
          result.font = faces.length > 0;
        },
        () => {
          result.font = false;
        },
      );
    });

    await browser.waitUntil(
      () =>
        browser.execute(() => {
          const result = (window as unknown as { epubResources: Record<string, boolean> })
            .epubResources;
          return result.image !== undefined && result.font !== undefined;
        }),
      { timeout: 15000, timeoutMsg: "the EPUB's image and font never settled" },
    );
    const result = await browser.execute(
      () => (window as unknown as { epubResources: Record<string, boolean> }).epubResources,
    );
    expect(result).toEqual({ image: true, font: true });
  });

  // foliate-js serves a linked stylesheet as a blob: URL; vertical writing comes from it.
  it("still applies the stylesheets linked from an EPUB", async () => {
    const writingMode = await browser.execute(() => {
      type Renderer = { getContents(): { doc: Document }[] };
      const view = document.querySelector("foliate-view") as Element & { renderer: Renderer };
      const doc = view.renderer.getContents()[0].doc;
      return doc.defaultView?.getComputedStyle(doc.body).writingMode;
    });
    expect(writingMode).toBe("vertical-rl");
  });
});
