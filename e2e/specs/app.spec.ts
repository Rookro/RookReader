import { expect, browser, $ } from "@wdio/globals";

describe("RookReader Application E2E Tests", () => {
  it("should start successfully and render the React root element", async () => {
    const rootElement = $("#root");

    await rootElement.waitForExist();
    await expect(rootElement).toExist();
  });

  it("should initially render the application UI", async () => {
    const mainContent = $('[data-testid="main-content"]');
    await expect(mainContent).toExist();

    // The settings button is shared across the main views (Bookshelf and BookReader)
    // Its presence confirms the application UI has successfully loaded and rendered.
    const settingsButton = $('[aria-label="settings"]');
    await settingsButton.waitForExist();
    await expect(settingsButton).toExist();
  });

  it("should open settings when settings button is clicked", async () => {
    const settingsButton = $('[aria-label="settings"]');
    await settingsButton.waitForExist();
    await settingsButton.click();

    await browser.waitUntil(
      async () => {
        const handles = await browser.getWindowHandles();
        return handles.length > 1;
      },
      {
        timeout: 3000,
        timeoutMsg: "Failed to open a new window within the time limit.",
      },
    );

    const mainWindowHandle = await browser.getWindowHandle();
    const allHandles = await browser.getWindowHandles();
    const newWindowHandle = allHandles.find((handle) => handle !== mainWindowHandle);
    if (!newWindowHandle) {
      throw new Error("No new window handle found");
    }
    await browser.switchToWindow(newWindowHandle);

    const settingsContainer = $('[data-testid="settings-container"]');
    await settingsContainer.waitForExist();
    await expect(settingsContainer).toExist();

    const settingsTabs = $('[aria-label="setttings tabs"]');
    await settingsTabs.waitForExist();
    await expect(settingsTabs).toExist();
  });
});
