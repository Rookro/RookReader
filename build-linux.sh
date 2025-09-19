rm -r src-tauri/libs
mkdir src-tauri/libs
cp src-tauri/dependencies/windows/* src-tauri/libs
yarn
# set NO_STRIP true.
# https://github.com/tauri-apps/tauri/issues/8929
NO_STRIP=true yarn tauri build
