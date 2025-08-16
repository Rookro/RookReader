rustup target add x86_64-pc-windows-msvc
cargo install --locked cargo-xwin
yarn
yarn tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc
