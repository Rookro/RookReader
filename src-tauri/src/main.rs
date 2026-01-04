// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Use X11 backend on Linux as a workaround for window sizing/positioning issues on Wayland.
    #[cfg(target_os = "linux")]
    {
        std::env::set_var("GDK_BACKEND", "x11");
        apply_nvidia_fixes();
    }

    rookreader_lib::run();
}

/// Applies fixes for NVIDIA GPUs on Linux to avoid rendering issues with WebKitGTK.
#[cfg(target_os = "linux")]
fn apply_nvidia_fixes() {
    let rt_result = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build();

    match rt_result {
        Ok(rt) => {
            rt.block_on(async {
                let instance = wgpu::Instance::default();
                let adapter_result = instance
                    .request_adapter(&wgpu::RequestAdapterOptions {
                        power_preference: wgpu::PowerPreference::None,
                        force_fallback_adapter: false,
                        compatible_surface: None,
                    })
                    .await;

                match adapter_result {
                    Ok(adapter) => {
                        let info = adapter.get_info();
                        // NVIDIA Vendor ID 0x10de
                        if info.vendor == 0x10de || info.name.to_lowercase().contains("nvidia") {
                            println!(
                                "[Info] NVIDIA GPU detected. (name:{}, vendor: {:#x}). Applied WebKitGTK fix.",
                                info.name, info.vendor
                            );
                            std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
                        }
                    }
                    Err(e) => {
                        eprintln!("Failed to get the GPU adapter info: {}", e);
                    }
                }
            });
        }
        Err(e) => {
            eprintln!(
                "Failed to Failed to initialize tokio runtime for GPU check: {}",
                e
            )
        }
    }
}
