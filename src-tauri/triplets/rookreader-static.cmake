# The one triplet both platforms build dav1d with, so `vcpkg install --triplet rookreader-static`
# lands the library at the same path (vcpkg_installed/rookreader-static/lib) on Windows and
# Linux: a static library against the dynamic C runtime, which is what Rust's MSVC target links.
set(VCPKG_TARGET_ARCHITECTURE x64)
set(VCPKG_CRT_LINKAGE dynamic)
set(VCPKG_LIBRARY_LINKAGE static)
if(NOT CMAKE_HOST_WIN32)
    set(VCPKG_CMAKE_SYSTEM_NAME Linux)
endif()
