<!-- Source of truth: docs/wiki/ in https://github.com/Rookro/RookReader. Edit it there (same PR as the code change); the GitHub Wiki is overwritten on every release. -->

## Frequently Asked Questions

### Where is my data (database and settings) saved?
RookReader stores its application data — the SQLite database (`rook-reader.db`: collections, tags, series, bookmarks and reading history), the settings file, and the thumbnail cache — in your operating system's standard application data directory:
- **Windows**: `C:\Users\<YourUser>\AppData\Roaming\io.github.rookro.rookreader`
- **Linux**: `~/.local/share/io.github.rookro.rookreader` (or `$XDG_DATA_HOME/io.github.rookro.rookreader`)

### The EPUB novel reading feature is not displaying correctly.
The EPUB support is currently an **experimental feature**. Complex formatting, custom CSS, or certain text alignments might not render perfectly yet. We are actively working on improving the EPUB parser and rendering engine.

### Does RookReader support Left-to-Right reading?
Yes. While optimized for right-to-left Japanese content, you can switch the direction of any comic with the direction toggle button in the top app bar. The choice is remembered **per book**; the direction used the first time a book is opened comes from **Settings → Reader → Default page direction**.

### Why is the direction toggle disabled while reading an EPUB?
EPUB novels turn pages in the direction the book itself declares (its page progression direction, or the writing mode of its text: vertical → right-to-left, horizontal → left-to-right). The toggle only shows the detected direction and cannot override it.

## Troubleshooting

### Application crashes on startup (Linux)
Ensure that you have all the required dependencies installed, in particular WebKit2GTK 4.1 (`libwebkit2gtk-4.1-0` on Debian/Ubuntu, `webkit2gtk-4.1` on Arch). If you are using an AppImage, you may need to install `libfuse2` depending on your distribution version.

### Blank screen or window does not appear (Linux AppImage)
Depending on your Wayland/X11 environment, the AppImage might fail to render the window correctly, resulting in a blank white screen or the window not appearing at all. 
If you encounter this issue, try running the AppImage from the terminal with the following environment variable:
```bash
LD_PRELOAD=/usr/lib/libwayland-client.so ./RookReader_x.x.x_amd64.AppImage
```
Alternatively, we recommend trying a distribution-specific package (such as `.deb` or `.rpm`) instead of the AppImage.

### Where can I find error logs?
Logs are written both to the terminal (when started from one) and to rotating log files (5 MiB each, the last 10 are kept). The **Developer** tab of the settings window shows the log directory and opens it with one click, and lets you raise the **Log level** (a restart is required). The `logs` directory is located at:
  - **Windows**: `C:\Users\<YourUser>\AppData\Local\io.github.rookro.rookreader\logs`
  - **Linux**: `~/.local/share/io.github.rookro.rookreader/logs` (or `$XDG_DATA_HOME/io.github.rookro.rookreader/logs`)

### The window position is restored but not its size (Linux)
This is intentional. Under Wayland, restoring the size made the window grow a few pixels on every launch, so on Linux the main and settings windows always open at their default size; the position, the maximized state and full screen are still restored.
