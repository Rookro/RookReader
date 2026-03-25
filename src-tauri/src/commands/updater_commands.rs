/// Checks if the auto-updater is supported on the current platform/environment.
///
/// Returns `true` if the updater is supported, `false` otherwise.
/// - Windows: Always supported.
/// - macOS: Always supported.
/// - Linux: Supported only if running as an AppImage (checked via `APPIMAGE` environment variable).
#[tauri::command]
pub fn is_updater_supported() -> bool {
    #[cfg(target_os = "linux")]
    {
        std::env::var("APPIMAGE").is_ok()
    }

    #[cfg(target_os = "windows")]
    {
        true
    }

    #[cfg(target_os = "macos")]
    {
        true
    }

    // Fallback for other platforms (e.g., Android, iOS) where updater might not be supported
    #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
    {
        false
    }
}
