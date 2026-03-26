import { expect, browser, $ } from "@wdio/globals";
import { Key } from "webdriverio";
import path from "node:path";

describe("RookReader E2E Tests - Page Navigation", () => {
  it("should load a directory and navigate pages", async () => {
    const bookshelf = $('[data-testid="bookshelf"]');
    if (await bookshelf.isDisplayed()) {
      const returnToReaderButton = $('button[aria-label="book-reader"]');
      await returnToReaderButton.waitForDisplayed();
      await expect(returnToReaderButton).toBeDisplayed();

      await returnToReaderButton.click();
    }

    const bookReader = $('[data-testid="book-reader"]');
    await bookReader.waitForDisplayed();
    await expect(bookReader).toBeDisplayed();

    const pathInput = $('input[aria-label="container-path-input"]');
    await pathInput.waitForDisplayed();

    const dummyPath = path.join(process.cwd(), "e2e", "fixtures", "dummy_book");

    // Clear the path input manually since clearValue() won't work here.
    await pathInput.click();
    await browser.keys([Key.Ctrl, "a"]);
    await browser.keys(Key.Delete);

    await pathInput.addValue(dummyPath);
    await browser.keys(Key.Enter);

    // Wait for the loading images to finish.
    await browser.pause(1000);

    const pageIndicator = $('[aria-label="page-indicator"]');
    await pageIndicator.waitForDisplayed();

    await browser.waitUntil(
      async () => {
        const text = await pageIndicator.getText();
        return text.includes("/3");
      },
      { timeout: 10000, timeoutMsg: "Expected page indicator to show out of 3 pages" },
    );

    const comicReaderArea = $('[data-testid="comic-reader-area"]');
    await comicReaderArea.waitForDisplayed();

    // Test left click navigation
    let currentText = await pageIndicator.getText();
    await comicReaderArea.click();

    await browser.waitUntil(
      async () => {
        const text = await pageIndicator.getText();
        return text !== currentText;
      },
      { timeout: 3000, timeoutMsg: "Expected page to change after left click" },
    );

    // Test right click navigation
    currentText = await pageIndicator.getText();
    await comicReaderArea.click({ button: "right" });

    await browser.waitUntil(
      async () => {
        const text = await pageIndicator.getText();
        return text !== currentText;
      },
      { timeout: 3000, timeoutMsg: "Expected page to change after right click" },
    );

    // Test keyboard navigation
    currentText = await pageIndicator.getText();
    await browser.keys(["ArrowLeft"]);

    await browser.waitUntil(
      async () => {
        const text = await pageIndicator.getText();
        return text !== currentText;
      },
      { timeout: 3000, timeoutMsg: "Expected page to change after ArrowLeft" },
    );

    currentText = await pageIndicator.getText();
    await browser.keys(["ArrowRight"]);

    await browser.waitUntil(
      async () => {
        const text = await pageIndicator.getText();
        return text !== currentText;
      },
      { timeout: 3000, timeoutMsg: "Expected page to change after ArrowRight" },
    );
  });
});
