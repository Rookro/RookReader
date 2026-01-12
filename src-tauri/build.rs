use std::env;
use std::io::Cursor;
use std::path::Path;

use tauri_build::WindowsAttributes;

fn main() {
    if let Err(e) = download_and_extract_pdfium() {
        eprintln!("Failed to download and extract PDFium: {}", e);
        std::process::exit(1);
    }

    if let Err(e) = tauri_build::try_build(
        tauri_build::Attributes::new()
            .windows_attributes(WindowsAttributes::new_without_app_manifest()),
    ) {
        eprintln!("Failed to run tauri-build: {}", e);
        std::process::exit(1);
    }

    #[cfg(windows)]
    {
        // workaround needed to prevent `STATUS_ENTRYPOINT_NOT_FOUND` error in tests
        // see https://github.com/tauri-apps/tauri/pull/4383#issuecomment-1212221864
        let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
        let target_env = std::env::var("CARGO_CFG_TARGET_ENV");
        let is_tauri_workspace =
            std::env::var("__TAURI_WORKSPACE__").map_or(false, |v| v == "true");
        if is_tauri_workspace && target_os == "windows" && Ok("msvc") == target_env.as_deref() {
            embed_manifest_for_tests();
        }
    }
}

#[cfg(windows)]
fn embed_manifest_for_tests() {
    static WINDOWS_MANIFEST_FILE: &str = "windows-app-manifest.xml";

    let manifest = match std::env::current_dir() {
        Ok(dir) => dir.join(WINDOWS_MANIFEST_FILE),
        Err(e) => {
            println!(
                "cargo:warning=Failed to determine current dir for manifest: {}",
                e
            );
            return;
        }
    };

    println!("cargo:rerun-if-changed={}", manifest.display());
    // Embed the Windows application manifest file.
    println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
    println!(
        "cargo:rustc-link-arg=/MANIFESTINPUT:{}",
        manifest.to_string_lossy()
    );
    // Turn linker warnings into errors.
    println!("cargo:rustc-link-arg=/WX");
}

// The PDFium version.
// https://github.com/bblanchon/pdfium-binaries/releases
const PDFIUM_VERSION: &str = "chromium/7616";

/// Gets the PDFium filename to download based on the build target OS and architecture.
fn get_pdfium_filename() -> Result<String, Box<dyn std::error::Error>> {
    let target_os = env::var("CARGO_CFG_TARGET_OS")?;
    let target_arch = env::var("CARGO_CFG_TARGET_ARCH")?;

    let platform = match (target_os.as_str(), target_arch.as_str()) {
        ("windows", "x86_64") => "win-x64",
        ("linux", "x86_64") => "linux-x64",
        // Unsupported
        //("linux", "aarch64") => "linux-arm64",
        //("macos", "x86_64") => "mac-x64",
        //("macos", "aarch64") => "mac-arm64",
        _ => return Err(format!("Unsupported platform: {}-{}", target_os, target_arch).into()),
    };

    Ok(format!("pdfium-{}.tgz", platform))
}

/// Downloads and extracts the PDFium binaries.
fn download_and_extract_pdfium() -> Result<(), Box<dyn std::error::Error>> {
    let filename = get_pdfium_filename()?;
    let version_encoded = PDFIUM_VERSION.replace("/", "%2F");
    let download_url = format!(
        "https://github.com/bblanchon/pdfium-binaries/releases/download/{}/{}",
        version_encoded, filename
    );

    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:info=Downloading PDFium from {}", download_url);

    let response = reqwest::blocking::get(&download_url)?.error_for_status()?;
    let content = Cursor::new(response.bytes()?);

    let out_dir = Path::new(&env::var("CARGO_MANIFEST_DIR")?)
        .join("target")
        .join("dependencies")
        .join("pdfium");

    let tar = flate2::read::GzDecoder::new(content);
    let mut archive = tar::Archive::new(tar);
    archive.unpack(&out_dir)?;

    println!(
        "cargo:info=PDFium extracted to {}",
        out_dir.to_string_lossy()
    );

    Ok(())
}
