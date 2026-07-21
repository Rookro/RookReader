import { $, browser } from "@wdio/globals";

/**
 * Reader input operations that the embedded @wdio/tauri-service provider (1.2.0) cannot
 * drive faithfully, isolated here so the specs express intent and the workarounds can be
 * swapped out in one place once the provider is fixed.
 *
 * The provider does not drive OS-level input; it synthesizes JS DOM events
 * (`tauri-plugin-wdio-webdriver` `platform/executor.rs`), and two operations have gaps:
 *   - Right-click: only a `click` is synthesized for the primary button; `contextmenu` is
 *     never emitted, so `onContextMenu` handlers never fire.
 *   - Arrow keys: `keydown` is dispatched to `document.activeElement`, which after loading
 *     a book is a text input; the app ignores key events from inputs (see usePageNavigation),
 *     so navigation keys are swallowed.
 * Left-click already works through the provider, so specs call `element.click()` directly.
 *
 * WHEN THE PROVIDER IS FIXED, replace ONLY the marked body of each function with the real
 * WebDriver call shown in its comment; the specs that call these stay unchanged.
 */

/** Navigation keys understood by the reader's window keydown listener. */
export type NavigationKey = "ArrowLeft" | "ArrowRight";

/**
 * Right-clicks the target. In the reader this moves the page back.
 *
 * PROVIDER-WORKAROUND — emulates the browser's `contextmenu` event. When the provider
 * synthesizes right-click, replace the body with:
 *   const element = $(selector);
 *   await element.waitForDisplayed();
 *   await element.click({ button: "right" });
 */
export async function rightClick(selector: string): Promise<void> {
  await $(selector).waitForDisplayed();
  await browser.execute((sel: string) => {
    document
      .querySelector(sel)
      ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
  }, selector);
}

/**
 * Presses a navigation key. The reader listens for keydown on `window`.
 *
 * PROVIDER-WORKAROUND — dispatches `keydown` to `window`, bypassing the
 * activeElement/input-focus issue described above. When the provider routes keys
 * faithfully, replace the body with:
 *   await browser.keys(key); // key is the literal "ArrowLeft" / "ArrowRight"
 */
export async function pressKey(key: NavigationKey): Promise<void> {
  await browser.execute((k: string) => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
  }, key);
}
