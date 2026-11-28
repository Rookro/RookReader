import path from "node:path";

const lang = process.env.CAPTURE_LANG || "en";
const tmpRoot = process.env.CAPTURE_TMP_DIR;
if (!tmpRoot) {
  throw new Error("CAPTURE_TMP_DIR must be set (run via `npm run screenshots`).");
}

const repoRoot = process.cwd();
const libDir = path.join(tmpRoot, lang);

const meta =
  lang === "en"
    ? {
        locale: "en-US",
        books: [
          "Clockwork Harbor Vol. 1.cbz",
          "Clockwork Harbor Vol. 2.cbz",
          "Clockwork Harbor Vol. 3.cbz",
          "Starlight Express.cbz",
          "Forest of Lanterns.cbz",
          "Glass Observatory.cbz",
        ],
        collections: [
          { name: "Favorites", iconId: "bookmark" },
          { name: "Reading", iconId: "auto-stories" },
          { name: "Fantasy", iconId: "collections-bookmark" },
        ],
        tags: [
          { name: "Manga", colorCode: "#3b82f6" },
          { name: "Fantasy", colorCode: "#a855f7" },
          { name: "Sci-Fi", colorCode: "#06b6d4" },
          { name: "Slice of Life", colorCode: "#22c55e" },
        ],
        seriesName: "Clockwork Harbor",
        bookmarkName: "Page 2",
        fakeDir: "/home/reader/Books/Manga",
        fakeBookPath: "/home/reader/Books/Manga/Clockwork Harbor Vol. 1.cbz",
        outReader: path.join(repoRoot, "docs", "images", "reader_screenshot.png"),
        outBookshelf: path.join(repoRoot, "docs", "images", "bookshelf_screenshot.png"),
      }
    : {
        locale: "ja-JP",
        books: [
          "時計仕掛けの港 第1巻.cbz",
          "時計仕掛けの港 第2巻.cbz",
          "時計仕掛けの港 第3巻.cbz",
          "星屑急行.cbz",
          "ランタンの森.cbz",
          "硝子の天文台.cbz",
        ],
        collections: [
          { name: "お気に入り", iconId: "bookmark" },
          { name: "読書中", iconId: "auto-stories" },
          { name: "ファンタジー", iconId: "collections-bookmark" },
        ],
        tags: [
          { name: "漫画", colorCode: "#3b82f6" },
          { name: "ファンタジー", colorCode: "#a855f7" },
          { name: "SF", colorCode: "#06b6d4" },
          { name: "日常", colorCode: "#22c55e" },
        ],
        seriesName: "時計仕掛けの港",
        bookmarkName: "2ページ",
        fakeDir: "/home/reader/本/マンガ",
        fakeBookPath: "/home/reader/本/マンガ/時計仕掛けの港 第1巻.cbz",
        outReader: path.join(repoRoot, "docs", "images", "ja_JP", "reader_screenshot.png"),
        outBookshelf: path.join(repoRoot, "docs", "images", "ja_JP", "bookshelf_screenshot.png"),
      };

/**
 * Opens a book path in the reader via the top toolbar's container path form.
 *
 * @param {string} filePath - Absolute path to the book archive.
 */
async function openPathInReader(filePath) {
  const input = await $('input[aria-label="container-path-input"]');
  await input.waitForDisplayed({ timeout: 15000 });
  await input.setValue(filePath);
  await browser.execute(() => {
    document
      .querySelector('input[aria-label="container-path-input"]')
      ?.form?.requestSubmit();
  });
}

describe(`Capture ${lang.toUpperCase()} documentation screenshots`, () => {
  it("seeds sample library and captures reader & bookshelf views", async () => {
    const reader = await $('[data-testid="book-reader"]');
    await reader.waitForDisplayed({ timeout: 20000 });

    await browser.waitUntil(
      async () =>
        await browser.execute(() =>
          Boolean(window.__TAURI__?.core?.invoke && window.__TAURI__?.event?.emit),
        ),
      { timeout: 15000, timeoutMsg: "window.__TAURI__ bridge not available" },
    );

    // Switch locale without reloading the WebView.
    await browser.execute(async (locale) => {
      await window.__TAURI__.event.emit("locale-changed", { language: locale });
    }, meta.locale);
    await browser.pause(500);

    // Seed books, collections, tags, series, reading progress, and a bookmark via real commands.
    await browser.execute(async (cfg, dir) => {
      const invoke = window.__TAURI__.core.invoke;
      const bookIds = [];
      for (const fname of cfg.books) {
        const id = await invoke("register_book", { filePath: `${dir}/${fname}` });
        bookIds.push(id);
      }

      const existingCols = await invoke("get_all_collections");
      if (cfg.locale === "ja-JP") {
        for (const c of existingCols) {
          await invoke("delete_collection", { id: c.id });
        }
      }
      const existingByName = new Map(
        (cfg.locale === "ja-JP" ? [] : existingCols).map((c) => [c.name, c.id]),
      );
      const colIds = [];
      for (const c of cfg.collections) {
        if (existingByName.has(c.name)) {
          colIds.push(existingByName.get(c.name));
        } else {
          const col = await invoke("create_collection", { name: c.name, iconId: c.iconId });
          colIds.push(col.id);
        }
      }

      const tagIds = [];
      for (const t of cfg.tags) {
        const tag = await invoke("create_tag", { name: t.name, colorCode: t.colorCode });
        tagIds.push(tag.id);
      }

      const series = await invoke("create_series", { name: cfg.seriesName });
      for (let i = 0; i < 3; i++) {
        await invoke("set_series_for_book", { bookId: bookIds[i], seriesId: series.id });
      }
      await invoke("set_series_order", { bookIds: bookIds.slice(0, 3) });

      await invoke("set_collections_for_book", {
        bookId: bookIds[0],
        collectionIds: [colIds[0], colIds[1], colIds[2]],
      });
      await invoke("set_collections_for_book", {
        bookId: bookIds[3],
        collectionIds: [colIds[0], colIds[1]],
      });
      await invoke("set_collections_for_book", {
        bookId: bookIds[4],
        collectionIds: [colIds[2]],
      });
      await invoke("set_collections_for_book", {
        bookId: bookIds[5],
        collectionIds: [colIds[0]],
      });

      await invoke("set_tags_for_book", { bookId: bookIds[0], tagIds: [tagIds[0], tagIds[1]] });
      await invoke("set_tags_for_book", { bookId: bookIds[1], tagIds: [tagIds[0], tagIds[1]] });
      await invoke("set_tags_for_book", { bookId: bookIds[2], tagIds: [tagIds[0], tagIds[1]] });
      await invoke("set_tags_for_book", { bookId: bookIds[3], tagIds: [tagIds[2]] });
      await invoke("set_tags_for_book", { bookId: bookIds[4], tagIds: [tagIds[0], tagIds[1]] });
      await invoke("set_tags_for_book", { bookId: bookIds[5], tagIds: [tagIds[3]] });

      // Leave Vol. 1 unset at page 0 so turning forward once lands on the pages 2-3 spread.
      await invoke("update_reading_progress", { bookId: bookIds[1], pageIndex: 3, cfi: null });
      await invoke("update_reading_progress", { bookId: bookIds[3], pageIndex: 5, cfi: null });
      await invoke("update_reading_progress", { bookId: bookIds[4], pageIndex: 2, cfi: null });
      await invoke("update_reading_progress", { bookId: bookIds[5], pageIndex: 6, cfi: null });

      // Bookmark pages 2-3 BEFORE opening Vol. 1 so useBookmarkSync loads it on open.
      await invoke("create_bookmark", {
        bookId: bookIds[0],
        name: cfg.bookmarkName,
        pageIndex: 1,
        cfi: null,
      });
    }, meta, libDir);

    // 1. Capture Reader screenshot (two-page RTL spread + File Navigator).
    await openPathInReader(path.join(libDir, meta.books[0]));
    const pageIndicator = await $('[aria-label="page-indicator"]');
    await pageIndicator.waitForDisplayed({ timeout: 15000 });
    await browser.waitUntil(
      async () => (await pageIndicator.getText()).includes("/10"),
      { timeout: 15000, timeoutMsg: "Expected Vol. 1 page indicator to show /10" },
    );

    const beforeTurn = await pageIndicator.getText();
    const comicArea = await $('[data-testid="comic-reader-area"]');
    await comicArea.waitForDisplayed({ timeout: 15000 });
    await comicArea.click();
    await browser.waitUntil(
      async () => (await pageIndicator.getText()) !== beforeTurn,
      { timeout: 10000, timeoutMsg: "Expected page to turn to two-page spread" },
    );

    await browser.waitUntil(
      async () =>
        await browser.execute((expectedDir) => {
          const imgs = Array.from(document.querySelectorAll('[data-testid="comic-reader-area"] img'));
          if (imgs.length < 2) return false;
          if (!imgs.every((img) => img.complete && img.naturalWidth > 0)) return false;
          const navInput = document.querySelector(
            'input[name="path"]:not([aria-label="container-path-input"])',
          );
          if (!navInput || !navInput.value.includes(expectedDir)) return false;
          if (document.querySelector(".MuiCircularProgress-root")) return false;
          if (document.querySelector(".MuiSnackbar-root")) return false;
          return true;
        }, libDir),
      { timeout: 20000, timeoutMsg: "Reader spread images and File Navigator did not finish rendering" },
    );

    await browser.pause(400);

    // Replace displayed OS temp paths with neutral sample paths right before capture.
    await browser.execute((fakeBookPath, fakeDir) => {
      const topInput = document.querySelector('input[aria-label="container-path-input"]');
      const navInput = document.querySelector(
        'input[name="path"]:not([aria-label="container-path-input"])',
      );
      if (topInput) topInput.value = fakeBookPath;
      if (navInput) navInput.value = fakeDir;
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }, meta.fakeBookPath, meta.fakeDir);

    await browser.pause(300);
    await browser.saveScreenshot(meta.outReader);

    // 2. Open a standalone book so Bookshelf stays at top-level All Books and displays both
    // the stacked Series card and a standalone card marked Reading / 読書中.
    await openPathInReader(path.join(libDir, meta.books[3]));
    await browser.waitUntil(
      async () =>
        await browser.execute((expectedName) => {
          const topInput = document.querySelector('input[aria-label="container-path-input"]');
          return Boolean(topInput && topInput.value.includes(expectedName));
        }, meta.books[3]),
      { timeout: 15000, timeoutMsg: "Standalone book did not open" },
    );
    await browser.pause(400);

    const libraryBtn = await $('button[aria-label="library"]');
    await libraryBtn.waitForClickable({ timeout: 10000 });
    await libraryBtn.click();

    const bookshelf = await $('[data-testid="bookshelf"]');
    await bookshelf.waitForDisplayed({ timeout: 15000 });

    const coverSrcs = await browser.waitUntil(
      async () =>
        await browser.execute(() => {
          const imgs = Array.from(document.querySelectorAll('[data-testid="bookshelf"] img'));
          if (imgs.length < 4) return false;
          if (!imgs.every((img) => img.complete && img.naturalWidth > 0)) return false;
          if (document.querySelector(".MuiCircularProgress-root")) return false;
          if (document.querySelector(".MuiSnackbar-root")) return false;
          return imgs.map((img) => img.src);
        }),
      { timeout: 20000, timeoutMsg: "Bookshelf covers did not finish loading" },
    );

    for (const src of coverSrcs) {
      if (
        !(src.startsWith("asset://localhost/") || src.includes("asset.localhost")) ||
        src.includes("dummy_thumbnail")
      ) {
        throw new Error(`Cover image did not load from asset protocol: ${src}`);
      }
    }

    await browser.execute(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    });
    await browser.pause(400);
    await browser.saveScreenshot(meta.outBookshelf);
  });
});
