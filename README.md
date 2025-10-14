# RookReader

![build status](https://github.com/Rookro/RookReader/actions/workflows/build-app-actions.yml/badge.svg)
[![Tauri](https://img.shields.io/badge/Tauri-24C8D8?logo=tauri&logoColor=fff)](https://v2.tauri.app/ja/)
[![React](https://img.shields.io/badge/React-%2320232a.svg?logo=react&logoColor=%2361DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=fff)](https://www.typescriptlang.org/)
[![Rust](https://img.shields.io/badge/Rust-%23000000.svg?e&logo=rust&logoColor=white)](https://rust-lang.org/)
[![MIT License](https://img.shields.io/badge/license-MIT-green.svg?style=flat)](LICENSE)

## 概要

RookReader は、zip、rar、pdf 形式の電子書籍ファイルを閲覧するための、モダンで高速なクロスプラットフォームアプリケーションです。Windows および Linux 環境で利用可能です。

一般的なアーカイブファイルに含まれる画像シーケンス（コミックや雑誌など）を読み込む機能と、PDF ドキュメントを読み込む機能を統合することで、さまざまな電子書籍体験を一つのアプリで提供します。

## 特徴

クロスプラットフォーム対応: Windows と Linux で利用可能。

サポートするファイル形式:

* zip
* rar
* pdf

モダンな UI/UX: React + TypeScript による直感的で使いやすいインターフェース。

高性能: Rust のバックエンドと Tauri フレームワークによる、ネイティブに近いパフォーマンスとメモリ効率。

## インストール

アプリケーションのビルド済みバイナリは、GitHub の Release ページで提供されています。  
以下の手順で、お使いの環境に合ったファイルをダウンロードしてインストールしてください。

1. RookReader GitHub Releases ページ の[最新のリリース](https://github.com/Rookro/RookReader/releases/latest/)にアクセスします。
1. Windows ユーザーは、RookReader_x.x.x_x64-setup.exe (インストーラー) をダウンロードし、実行してください。  
  Linux ユーザーは、RookReader_x.x.x_amd64_PKGBUILD.zip をダウンロードし、インストールしてください。  
  deb ファイルとそれをインストールするための PKGBUILD を用意しています。

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
  コマンドパレット ( Ctrl+Shift+P または Cmd+Shift+P ) を開き、Remote-Containers: Open Folder in Container... を選択します。
1. DevContainer のビルドと起動が完了すると、必要な依存関係（Rust、Node.js など）がすべて揃った開発環境が利用可能になります。

### ビルド手順

DevContainer 内で、以下のコマンドを利用してビルドできます。

```bash
mkdir src-tauri/libs
# PDFium のビルド済み依存ライブラリを配置する
cp src-tauri/dependencies/linux/* src-tauri/libs
yarn
yarn tauri build
```

もしくは単に以下を実行してビルドできます。

```bash
./build-linux.sh
```

## 貢献

このプロジェクトへの貢献を歓迎します。バグ報告や機能提案は、GitHub の Issues にお願いします。コードの貢献は、Pull Request を送ってください。

## ライセンス

このプロジェクトは、[MIT License](LICENSE) の下で公開されています。
