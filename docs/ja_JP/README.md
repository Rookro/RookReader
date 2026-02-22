# RookReader

![build status](https://github.com/Rookro/RookReader/actions/workflows/build-app-actions.yml/badge.svg)
[![Tauri](https://img.shields.io/badge/Tauri-24C8D8?logo=tauri&logoColor=fff)](https://v2.tauri.app/ja/)
[![React](https://img.shields.io/badge/React-%2320232a.svg?logo=react&logoColor=%2361DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=fff)](https://www.typescriptlang.org/)
[![Rust](https://img.shields.io/badge/Rust-%23000000.svg?e&logo=rust&logoColor=white)](https://rust-lang.org/)
[![MIT License](https://img.shields.io/badge/license-MIT-green.svg?style=flat)](../../LICENSE)

[English](../../README.md) | [日本語](README.md)

## 概要

RookReader は、zip、rar、pdf 形式の電子書籍ファイルを閲覧するための、モダンで高速なクロスプラットフォームアプリケーションです。Windows および Linux 環境で利用可能です。

ディレクトリーや一般的なアーカイブファイルに含まれる画像シーケンス（コミックや雑誌など）、PDF ドキュメント、EPUB 形式の書庫をサポートし、日本語の小説やコミックの読書体験に特化しています。

## 特徴

* 日本語の縦書き対応（右開き対応）: 縦書きの小説や漫画を読む際に自然な、右から左へのページめくり（右開き）に標準で対応
* クロスプラットフォーム対応: Windows と Linux で利用可能
* サポートするファイル形式:
  * zip
  * rar
  * pdf
  * epub (注意: 小説閲覧機能は実験的な機能です。)
* モダンな UI/UX: React + TypeScript による直感的で使いやすいインターフェース
* 高性能: Rust のバックエンドと Tauri フレームワークによる、ネイティブに近いパフォーマンスとメモリ効率

## インストール

アプリケーションのビルド済みバイナリは、GitHub の Release ページで提供されています。  
以下の手順で、お使いの環境に合ったファイルをダウンロードしてインストールしてください。

1. RookReader の GitHub Releases ページ の[最新のリリース](https://github.com/Rookro/RookReader/releases/latest/)にアクセスします。
1. ご使用のOSに適したファイルをダウンロードし、以下のインストール方法に従ってください。

### Windows

| ファイル名 | インストール手順 |
| -- | -- |
| RookReader_x.x.x_x64-setup.exe | ダウンロードし、実行形式のインストーラーを実行します。 |

###  Linux

| ディストリビューション | 推奨ファイル | インストール手順 |
| -- | -- | -- |
| Debian/Ubuntu/Mint | RookReader_x.x.x_amd64.deb | ファイルをダブルクリックするか、ターミナルで `sudo dpkg -i <ファイル名>` を実行します。 |
| Fedora/RHEL/openSUSE | RookReader_x.x.x-x.x86_64.rpm | ターミナルで `sudo dnf install <ファイル名>` (または `sudo yum install <ファイル名>`) を実行します。 |
| Arch Linux/Manjaro | - | [Arch Linux 向け手順](#arch-linux-向け手順)を参照してください。|
| その他のディストリビューション | RookReader_x.x.x_amd64.AppImage | 実行権限を付与し (`chmod +x <ファイル名>`)、ファイルを実行します。インストールは不要です。 |

#### Arch Linux 向け手順

Arch Linux または Manjaro などのディストリビューションを使用している場合は、提供されている PKGBUILD を使用してパッケージをビルドし、インストールできます。

1. 以下のファイルをダウンロードします。

   | ファイル名 | ダウンロード場所 |
   | -- | -- |
   | PKGBUILD | リポジトリ内の PKGBUILD/ |
   | RookReader.install | リポジトリ内の PKGBUILD/ |

1. ダウンロードしたファイルをすべて同じディレクトリに配置します。
1. ターミナルを開き、そのディレクトリに移動して、以下のコマンドを実行し、パッケージをビルドおよびインストールします。

   ``` bash
   makepkg -si
   ```

## 使用方法

![screenshot](../images/screenshot.png)

* **ファイルを開く**
  * 左ペイン（ファイルナビゲーター）で、アーカイブファイルまたはディレクトリをクリックして開きます。
  * アーカイブファイルまたはディレクトリをアプリケーションウィンドウにドラッグアンドドロップします。

* **ページのナビゲート（移動）**
  * 画像表示エリアをクリックすると次のページへ、右クリックすると前のページへ移動することができます。
  * マウスホイールまたは矢印キーを使用しても、ページをめくることができます。

## 開発環境

本プロジェクトは、開発者間の環境差異を最小限に抑えるため、DevContainer を利用した開発フローを推奨しています。

### 前提条件

* Docker: コンテナ技術を利用するための必須要件
* VS Code (Visual Studio Code)
* VS Code Remote - Containers 拡張機能: VS Code でDevContainer を利用するための拡張機能。

### セットアップ手順

1. 本リポジトリをクローンします。

    ```bash
    git clone https://github.com/Rookro/RookReader.git
    ```

1. VS Codeでクローンしたフォルダを開きます。
1. VS Codeの右下に表示されるポップアップ「Reopen in Container」をクリックするか、  
  コマンドパレット ( Ctrl+Shift+P または Cmd+Shift+P ) を開き、「Remote-Containers: Open Folder in Container...」を選択します。
1. DevContainer のビルドと起動が完了すると、必要な依存関係（Rust、Node.js など）がすべて揃った開発環境が利用可能になります。

### ビルド手順

DevContainer 内で、以下のコマンドを利用してビルドできます。

```bash
yarn
yarn tauri build
```

## 貢献

このプロジェクトへの貢献を歓迎します。バグ報告や機能提案は、GitHub の Issues にお願いします。コードの貢献は、Pull Request を送ってください。

## ライセンス

このプロジェクトは、[MIT License](LICENSE) の下で公開されています。
