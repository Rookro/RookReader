import { expect, $ } from "@wdio/globals";

describe("RookReader E2E Tests - Reading Feature", () => {
  it("should navigate to the reader view from the bookshelf", async () => {
    const bookshelf = $('[data-testid="bookshelf"]');
    if (!(await bookshelf.isDisplayed())) {
      const libraryButton = $('button[aria-label="library"]');
      await libraryButton.waitForDisplayed();
      await libraryButton.click();
    }

    await bookshelf.waitForDisplayed();
    await expect(bookshelf).toBeDisplayed();

    const returnToReaderButton = $('button[aria-label="book-reader"]');
    await returnToReaderButton.waitForDisplayed();
    await expect(returnToReaderButton).toBeDisplayed();

    await returnToReaderButton.click();

    // Verify the reader view is displayed
    const bookReader = $('[data-testid="book-reader"]');
    await bookReader.waitForExist();
    await expect(bookReader).toExist();
    await expect(bookReader).toBeDisplayed();
  });

  it("should display reader navigation and control elements", async () => {
    const libraryButton = $('button[aria-label="library"]');
    const backButton = $('button[aria-label="back"]');
    const forwardButton = $('button[aria-label="forward"]');
    const toggleTwoPagedButton = $('button[aria-label="toggle-two-paged"]');
    const toggleDirectionButton = $('button[aria-label="toggle-direction"]');
    const settingsButton = $('button[aria-label="settings"]');

    await expect(libraryButton).toBeDisplayed();
    await expect(backButton).toBeDisplayed();
    await expect(forwardButton).toBeDisplayed();
    await expect(toggleTwoPagedButton).toBeDisplayed();
    await expect(toggleDirectionButton).toBeDisplayed();
    await expect(settingsButton).toBeDisplayed();

    const slider = $('[data-testid="control-slider"]');
    await expect(slider).toBeDisplayed();
  });

  it("should return to the bookshelf when library button is clicked", async () => {
    const libraryBotton = $('button[aria-label="library"]');
    await libraryBotton.waitForDisplayed();
    await libraryBotton.click();

    // Verify the bookshelf view is displayed again
    const bookshelf = $('[data-testid="bookshelf"]');
    await bookshelf.waitForDisplayed();
    await expect(bookshelf).toBeDisplayed();
  });
});
