import path from "node:path";
import { $, browser, expect } from "@wdio/globals";
import { pressKey, rightClick } from "../input";

describe("RookReader E2E Tests - Page Navigation", () => {
  it("should load a directory and navigate pages", async () => {
    const bookshelf = $('[data-testid="bookshelf"]');
    if (await bookshelf.isDisplayed()) {
      const returnToReaderButton = $('button[aria-label="book-reader"]');
      await returnToReaderButton.waitForDisplayed();
      await expect(returnToReaderButton).toBeDisplayed();
      await returnToReaderButton.waitForClickable();

      await returnToReaderButton.click();
    }

    const bookReader = $('[data-testid="book-reader"]');
    await bookReader.waitForDisplayed();
    await expect(bookReader).toBeDisplayed();

    const pathInput = $('input[aria-label="container-path-input"]');
    await pathInput.waitForDisplayed();

    const dummyPath = path.join(process.cwd(), "e2e", "fixtures", "dummy_book");

    // Submit the container-path form directly: the embedded WebDriver provider cannot
    // reliably submit via the Enter key, so drive the same submit the input's onBlur uses.
    await pathInput.setValue(dummyPath);
    await browser.execute(() => {
      document
        .querySelector<HTMLInputElement>('input[aria-label="container-path-input"]')
        ?.form?.requestSubmit();
    });

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
    await rightClick('[data-testid="comic-reader-area"]');

    await browser.waitUntil(
      async () => {
        const text = await pageIndicator.getText();
        return text !== currentText;
      },
      { timeout: 3000, timeoutMsg: "Expected page to change after right click" },
    );

    // Test keyboard navigation
    currentText = await pageIndicator.getText();
    await pressKey("ArrowLeft");

    await browser.waitUntil(
      async () => {
        const text = await pageIndicator.getText();
        return text !== currentText;
      },
      { timeout: 3000, timeoutMsg: "Expected page to change after ArrowLeft" },
    );

    currentText = await pageIndicator.getText();
    await pressKey("ArrowRight");

    await browser.waitUntil(
      async () => {
        const text = await pageIndicator.getText();
        return text !== currentText;
      },
      { timeout: 3000, timeoutMsg: "Expected page to change after ArrowRight" },
    );
  });
});
