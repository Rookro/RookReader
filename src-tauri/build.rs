use std::env;
use std::io::Cursor;
use std::path::Path;

fn main() {
    if let Err(e) = download_and_extract_pdfium() {
        panic!("Failed to download and extract PDFium: {}", e);
    }

    tauri_build::build()
}

// The PDFium version.
// https://github.com/bblanchon/pdfium-binaries/releases
const PDFIUM_VERSION: &str = "chromium/7543";

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

    let out_dir = Path::new(&env::var("OUT_DIR")?)
        .ancestors()
        .nth(4)
        .ok_or("Failed to get build directory from OUT_DIR")?
        .join("dependencies")
        .join("pdfium")
        .to_path_buf();

    let tar = flate2::read::GzDecoder::new(content);
    let mut archive = tar::Archive::new(tar);
    archive.unpack(&out_dir)?;

    println!(
        "cargo:info=PDFium extracted to {}",
        out_dir.to_string_lossy()
    );

    Ok(())
}
