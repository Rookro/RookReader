# Maintainer: Rookro
pkgname=RookReader
pkgver=1.3.0
pkgrel=1
pkgdesc="The book reader for a archive or pdf file."
arch=('x86_64')
url="https://github.com/Rookro/RookReader"
license=('MIT')
depends=('cairo' 'desktop-file-utils' 'gdk-pixbuf2' 'glib2' 'gtk3' 'hicolor-icon-theme' 'libsoup' 'pango' 'webkit2gtk-4.1')
options=('!strip' '!debug')
install=${pkgname}.install
source_x86_64=("RookReader_${pkgver}_amd64.deb")
sha256sums_x86_64=('772c4cd1ac65ef486802ebf7a00923b19a9c7c9e24796339f660b45f227dcfca')
package() {
  tar -xvf data.tar.gz -C "${pkgdir}"
}
