<!-- Source of truth: docs/wiki/ in https://github.com/Rookro/RookReader. Edit it there (same PR as the code change); the GitHub Wiki is overwritten on every release. -->

Welcome to the RookReader User Guide. This document provides detailed information on how to use the application.

## Installation & Setup

Pre-built binaries and installers for RookReader are available on our [GitHub Releases page](https://github.com/Rookro/RookReader/releases/latest).

### Windows

Download the `RookReader_x.x.x_x64-setup.exe` from the Releases page and run the installer.

### Linux

We provide various packages on the Releases page depending on your distribution:
- **Debian/Ubuntu/Mint**: Download the `.deb` file and install via `sudo dpkg -i <filename>`.
- **Fedora/RHEL/openSUSE**: Download the `.rpm` file and install via `sudo dnf install <filename>`.
- **Arch Linux/Manjaro**: Download `PKGBUILD` from the `PKGBUILD/` directory of the repository (nothing else is needed) and run `makepkg -si` in the directory containing it.
- **Universal**: Download the `.AppImage` file, make it executable (`chmod +x <filename>`), and run it.

## Basic Usage

### Opening Files

You can open comic archives (**zip, cbz, rar, cbr**), PDF documents, EPUB files, and **directories (folders) containing image sequences** by:
- **Single-clicking** a file or folder in the File Navigator (left pane). A folder of images opens as a book.
- **Dragging and dropping** a file or a folder directly onto the application window. This is especially useful for quickly viewing a folder full of downloaded manga or comic images without needing to archive them first.

**Double-clicking** a folder in the File Navigator enters it instead of opening it. The same works for zip/cbz/rar/cbr archives: double-click an archive to step into it like a folder and browse the folders inside. The File Navigator's own **Back**, **Forward**, **Up one level** buttons and path box all work across the archive boundary.

#### Folders inside archives

Each folder inside a zip/cbz/rar/cbr archive is treated as a **book of its own**. Opening the archive itself shows only the pages sitting directly inside it; archives without folders behave as before. Two related behaviors:
- **Open the folder inside an archive automatically** (Settings → Reader, on by default): when an archive holds no pages of its own and wraps them in a single folder (`comic.zip` → `Comic/`), that folder is opened in one click. Nested single folders are followed all the way down.
- A folder or archive with **no readable pages** is not recorded as a book. The message "The book contains no readable pages." is shown and the File Navigator moves into it so you can pick a folder inside.

### Reader Layout

The reader is made up of four areas:
- **Top app bar** — from left to right:
  - **Move to Bookshelf** — switch to the bookshelf view.
  - **Back / Forward** — return to the books you opened before, in the order you opened them (this is separate from the folder history of the File Navigator).
  - **Path box** — shows the path of the current book; type or paste a path to open that book directly (right-click for cut/copy/paste).
  - **Add / Remove bookmark** — bookmark the current position (see *Bookmarks* below).
  - **Toggle two-page spread** — switch between single-page and two-page view.
  - **Shift the spread pairing** — shift which pages share a screen by one page; click again to reset (see *Two-Page Spread* below). Disabled in single-page view.
  - **Direction toggle** — switch the current book between **Right-to-Left** (for Japanese comics) and **Left-to-Right**. The choice is remembered **for that book**. Disabled for EPUB novels, which follow their own writing direction (see *Novels (EPUB)* below).
  - **Settings** — open the settings window.
- **Side panels** (left): switch between them with the side tabs. Click a tab to open its panel. Clicking the **active tab** again collapses the panel, and clicking once more reopens it — useful for maximizing the reading area.
  - **File Navigator** — browse folders and archives, and open files. Its own bar has **Home folder**, **Back**, **Forward**, **Up one level** and **Refresh** buttons, a **sort order** menu (Name↑/↓, Date↑/↓), a path box for the folder being shown, and a search box that filters the list.
  - **Pages** — jump to any page using thumbnail previews. In two-page view both pages currently on screen are highlighted.
  - **History** — recently read books (shown only when reading history is enabled). Click an entry to open it; a search box filters the list, and right-clicking an entry offers **Open** and **Remove history**.
  - **Bookmarks** — the bookmarks saved in the current book (see *Bookmarks* below).
- **Reading area** (center) — where pages are displayed. If a page cannot be read, the reason is shown in its place.
- **Page slider** (bottom) — drag to quickly jump to any page in the current book.

### Keyboard Shortcuts & Controls

| Action | Mouse | Keyboard |
| :--- | :--- | :--- |
| **Next Page** | Left-click (image area) or Scroll Down | `Left Arrow` or `Right Arrow` |
| **Previous Page** | Right-click (image area) or Scroll Up | `Right Arrow` or `Left Arrow` |

> [!NOTE]
> The behavior of the `Left Arrow` and `Right Arrow` keys adapts automatically based on the reading direction (Right-to-Left vs. Left-to-Right) selected via the toggle button in the top app bar. For Japanese vertical reading (Right-to-Left), the Left Arrow goes to the Next Page, and the Right Arrow goes to the Previous Page.

## Page Display

### Reading Direction

Every book remembers its own page direction. The first time a book is opened it uses the **Default page direction** from **Settings → Reader** (Right-to-Left by default). Pressing the **direction toggle button** in the top app bar switches the direction for **that book only** and the choice is saved, so other books in your library are unaffected.

EPUB novels are the exception: their direction comes from the book itself (see *Novels (EPUB)*), and the toggle button is disabled while a novel is open.

### Two-Page Spread

RookReader can display two pages side by side, like an open book. Turn the view on or off with the **Toggle two-page spread** button in the top app bar; the spread follows the book's reading direction.

Which pages share a screen is worked out from where each page falls in the printed book, so the pairing is the same whether you reach a page by turning, by dragging the slider, from the Pages list, or from a bookmark. Books that contain a double-page illustration work out on their own whether the archive starts with the cover.

- **Show the initial page in single-page view** (**Settings → Reader**, on by default) shows the cover on its own rather than paired.
- For books that offer no clue about their pairing, press **Shift the spread pairing** in the top app bar to shift the pairing by one page; press it again to reset. The shift is remembered the next time you open that book.

### Magnifier (Loupe)

Magnify part of a page to read small text or inspect fine detail. Press the configured key or mouse button — the **middle mouse button** by default — to toggle the loupe on, then move the cursor over the page to magnify the area under it. Press again to turn it off. The loupe magnifies the page at its **full original size**, so detail that was shrunk to fit the window becomes readable. You can change the **zoom level** (default 2×), the **size (radius, default 200 px)**, and the **toggle key/button** (the middle, back or forward mouse button, or a keyboard key — either can be combined with Ctrl, Alt, Shift or Meta) in **Settings → Reader**.

## Continuous Reading (Auto-open Adjacent Book)

When you reach the end of a volume in a multi-volume series, RookReader can automatically open the **next book** so you can keep reading without returning to the bookshelf or file list. Paging back from the first page opens the **previous book**.

Choose a mode under **Settings → Reader → Auto-open Adjacent Book**:

| Mode | Behavior |
| :--- | :--- |
| **Off** | Do nothing at the start/end of a book (the page simply stops). |
| **Ask before opening** | Show a confirmation dialog before opening the adjacent book. *(Default)* |
| **Auto-open** | Open the adjacent book immediately. |

- Turning the page forward on the **last page** opens the next book on its **first page**; turning back on the **first page** opens the previous book on its **last page**. This works with clicks, the scroll wheel, and the arrow keys. A short notification appears while the book is opening.
- **Which book is opened next?** It depends on how the current book was opened:
  - **From a Bookshelf**: If the book belongs to a registered **series**, the next/previous **volume** in the series is opened. Otherwise, the next/previous book in the bookshelf's current **sort order** is used.
  - **From the File Navigator, History, drag & drop, or restored on startup**: The next/previous item in the **same folder** is opened (image folders are included), following the File Navigator's current sort order. When the current book is a folder inside an archive, the next/previous folder **inside that archive** is used.

> [!NOTE]
> If there is no adjacent book to open, a "No next book found." (or "No previous book found.") message is shown and you stay on the current page. This feature applies to the comic / image reader (zip, cbz, rar, cbr, PDF, and image folders); the EPUB novel reader is not covered yet.

## Bookmarks

Save any number of positions in a book and jump back to them later.

- **Add a bookmark**: press the **bookmark button** in the top app bar. The bookmark is named after the page number (for novels, after the section title when the book provides one). Press the button again on a bookmarked position to remove it.
- **Use bookmarks**: open the **Bookmarks** tab in the side pane. Click a bookmark to go to it; right-click one for **Jump**, **Rename** and **Remove bookmark**.
- Bookmarks work for both comics and EPUB novels. In a novel a bookmark returns you to the exact position in the text.

> [!NOTE]
> Comic bookmarks are stored as page numbers. If an archive is later split into several books (see *Folders inside archives*), a bookmark saved before the split may land on a different page.

## Bookshelf Management

Press **Move to Bookshelf** in the reader's top app bar to open the **Bookshelves** view, where your library is organized into **collections** and **tags**. The left pane lists them; **All Books** shows every registered book. Press **Return to reader** to go back.

- **Create a collection**: press **New collection** next to the *Collections* heading and give it a name and a custom icon.
- **Add books**: press **Add books** in the top bar, then **drag and drop** files and folders from your computer onto the dialog or press **Select files**. Added books appear in the current collection (or in *All Books*).
- **Sort and search**: type in the search box to filter by title (right-click the box for cut/copy/paste), and choose **Sort by** Name (A→Z / Z→A) or Date (Oldest / Newest first). **Change grid size** switches between small, medium and large covers.
- **Select several books**: **Ctrl/Cmd+click** toggles a book, **Shift+click** selects a range. The action bar that appears lets you **Add to collections**, **Set series**, **Set tags** or **Remove books** for the whole selection at once.
- **Right-click a book** for the same actions on a single book.
- **Keyboard**: the arrow keys move the focus through the grid, **Home** / **End** jump to the first / last item, and **Enter** or **Space** opens the focused book or series.
- **Delete a collection or tag** by right-clicking it in the left pane and choosing **Delete**. A confirmation dialog is shown first; deleting a collection keeps its books in your library.
- The book you are currently reading is marked **Reading** and the bookshelf scrolls to it when opened.

### Series

Group the volumes of the same title into a **series** with **Set series** (create a new series or pick an existing one). A series appears as a single stacked cover on the bookshelf; open it to see its volumes, and use **Edit Series Order** (in the top bar while the series is open, or by right-clicking its cover) to drag the volumes into reading order. Opening a series volume from the bookshelf lets *Auto-open Adjacent Book* follow the correct volume order, regardless of file names. Right-click the cover and choose **Ungroup series** (after a confirmation) to show the books individually again without deleting them.

## Tagging System

Categorize your collection using tags.
- Press **New tag** next to the *Tags* heading to create a tag with a name and a color, then assign tags to books with **Set tags** (right-click a book, or select several books first).
- Click a tag in the left pane to show only the books carrying it, which makes large collections easy to navigate.

## Reading History & Resume

When **reading history** is enabled (Settings → Reader), RookReader remembers the books you open and the page you stopped on, so reopening a book resumes from where you left off. EPUB novels resume at the **exact reading position** in the text, not just the chapter. You can browse and reopen recently read books from the **History** panel in the reader, and **Restore last read book on startup** (Settings → General) reopens the most recent book when the app starts.

## Novels (EPUB)

RookReader opens EPUB files in a dedicated text reader. You can adjust the **font family** and **font size** for novels in **Settings → Reader**.

- **Page direction** is taken from the book itself: the page progression direction it declares, or — when it declares none — the writing mode of its body text (vertically written books turn right-to-left, horizontally written ones left-to-right). The direction toggle in the top app bar is disabled for novels and only shows the detected direction; the page slider follows it too.
- **Bookmarks** and **reading history** return you to the exact position in the text.
- If the file has been moved, deleted or cannot be read, the reader says so instead of showing an empty page.

> [!WARNING]
> EPUB support is currently **experimental**. Complex formatting or custom styling may not render perfectly yet.

## Settings & Customization

Open the settings window with the **Settings** button in the reader's top app bar. Settings are grouped into tabs: **General, Bookshelf, File Navigator, Reader, Rendering & Performance, Developer,** and **About**. Settings apply immediately and are shared between windows.

### General
- **Language**: English / 日本語.
- **Font family**: the font used for the application's own interface.
- **Theme**: System, Light or Dark.
- **Initial view on startup**: Reader or Bookshelf.
- **Restore last read book on startup** (ignored when reading history is off).
- **Check for updates on startup**.

### Bookshelf
- **Auto-scroll text**: scroll long titles in the bookshelf. Turn it off if the bookshelf feels slow.

### File Navigator
- **Home folder**: the folder opened by the Home button.
- **Watch folders and files for changes**: refresh the list automatically when files change. May cause high load in folders with many files.

The file list's **sort order** (Name↑/↓, Date↑/↓) is chosen in the File Navigator panel itself and is remembered; *Auto-open Adjacent Book* follows it too.

### Reader
- **Default page direction**: Right to left / Left to right — the direction a book turns pages the first time you open it. Changing the direction while reading is remembered for that book only (see *Reading Direction*).
- **Show the initial page in single-page view**: show the cover on its own in two-page view.
- **Auto-open adjacent book**: Off / Ask before opening / Auto-open — see *Continuous Reading*.
- **Open the folder inside an archive automatically** — see *Folders inside archives*.
- **Loupe**: toggle key, zoom level and radius — see *Magnifier (Loupe)*.
- **Font family** and **Font size** (under *Novel*): the font used for EPUB novels.
- **Reading history**: record the books you read and your position in them.

### Rendering & Performance
Pages may be PNG, JPEG, GIF, APNG, WebP or AVIF (still images; AVIF image sequences are not supported). They are always rendered at the size they are displayed at, which keeps screentones free of moiré. Animated pages (GIF, APNG, WebP) are the exception: they are never resized, so every frame plays.
- **Show preview while loading**: display a low-resolution thumbnail until the full page is ready.
- **Maximum image height (px)**: an additional cap on page height. A page taller than this is shrunk to it even when the reader area is taller; `0` lets the reader area alone decide.
- **Resizing method**: the resampling algorithm, from Nearest Neighbor (fastest) to Lanczos 3 (best quality, the default).
- **PDF rendering height (px)**: the height PDF pages are rasterized at before being fitted to the reader area (default 2000). Raise it for large or high-resolution displays; lower it to open PDFs faster. Takes effect the next time a book is opened.
- **Preload page count**: pages loaded ahead in each direction (default 10).
- **Page reader threads**: how many threads may read pages at once; `0` lets the app choose. Formats that allow only one reader (solid RAR, EPUB, PDF) stay at one regardless. Lower it for books on a network drive. Takes effect the next time a book is opened.
- **Image cache size (MiB)**: the in-memory page cache (default 1024). Resized pages are kept uncompressed, so lower this if memory use is a concern; changing it clears the cache.

### Developer
- **Log level** (Trace … Error; restart required) and a shortcut to the **log directory**.
- **Experimental features**: where switches for features under development appear. There are none at the moment.

### About
Version, project page, **Check for updates**, and the third-party licenses of the bundled libraries.

> [!NOTE]
> Numeric settings are validated against their valid range. An out-of-range or non-integer value is rejected and the valid range is shown right below the field.
