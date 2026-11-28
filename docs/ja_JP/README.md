# RookReader

[![Latest Release](https://img.shields.io/github/v/release/Rookro/RookReader)](https://github.com/Rookro/RookReader/releases/latest)
[![Build](https://github.com/Rookro/RookReader/actions/workflows/build-app-actions.yml/badge.svg?branch=develop)](https://github.com/Rookro/RookReader/actions/workflows/build-app-actions.yml)
[![Full Validation](https://github.com/Rookro/RookReader/actions/workflows/full-validation.yml/badge.svg)](https://github.com/Rookro/RookReader/actions/workflows/full-validation.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-green.svg?style=flat)](../../LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-24C8D8?logo=tauri&logoColor=fff)](https://v2.tauri.app/ja/)
[![MUI](https://img.shields.io/badge/Material%20UI-007FFF?logo=mui&logoColor=fff)](https://mui.com/material-ui/)
[![React](https://img.shields.io/badge/React-%2320232a.svg?logo=react&logoColor=%2361DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=fff)](https://www.typescriptlang.org/)
[![Rust](https://img.shields.io/badge/Rust-%23000000.svg?logo=rust&logoColor=white)](https://rust-lang.org/)

[English](../../README.md) | [日本語](README.md) · [ユーザーガイド（英語）](https://github.com/Rookro/RookReader/wiki/User-Guide) | [FAQ（英語）](https://github.com/Rookro/RookReader/wiki/FAQ-&-Troubleshooting) | [開発者ガイド（英語）](https://github.com/Rookro/RookReader/wiki/Developer-Guide) | [変更履歴](CHANGELOG.md)

RookReader は、**Windows** および **Linux** 向けの高速でモダンなデスクトップ電子書籍・コミックリーダーです。日本語の縦書き・右開きに標準対応し、書庫ファイルや画像フォルダ、PDF、EPUB を快適に閲覧できるほか、本棚機能でライブラリをすっきり整理できます。

![RookReader の読書画面](../images/ja_JP/reader_screenshot.png)

## 主な機能

- **幅広いファイル形式に対応:** `zip`、`cbz`、`rar`、`cbr`（書庫内フォルダを含む）、画像ディレクトリ、`pdf`、`epub` *(小説閲覧は実験的機能)*。ページ画像は `png` / `apng`、`jpeg`、`gif`、`webp`、`avif` に対応。
- **日本語の縦書き・右開きに最適化:** 標準で右から左へのページ送りに対応し、本ごとに右開き／左開きを切り替えて記憶できます。
- **快適なページ表示:** 見開き表示（表紙の単ページ表示や見開きペア調整に対応）と、細部まで鮮明に拡大できるルーペ機能を搭載。
- **連続読書と続きから再開:** 巻末・巻頭から前後の巻を自動で開く連続読書、しおり管理、読書履歴からの正確な位置復帰に対応。
- **本棚・シリーズ・タグ管理:** カスタムアイコン付きのコレクション、巻順を並べ替えられるシリーズまとめ、カラータグでの分類や検索・並び替えに対応。
- **高速・高画質:** Rust + Tauri バックエンドによる先読みキャッシュと、モアレを抑えた高品質なリサイズ処理。
- **使いやすいデスクトップ UI:** ライト／ダークテーマ、日本語・英語 UI、キーボード操作、アップデート確認機能を搭載。

## インストール

ビルド済みバイナリは [GitHub Releases](https://github.com/Rookro/RookReader/releases/latest) からダウンロードできます。お使いの環境に合ったファイルを選んでください。

### Windows

| ファイル名 | インストール手順 |
| :--- | :--- |
| `RookReader_x.x.x_x64-setup.exe` | ダウンロードしてインストーラーを実行します。 |

### Linux

| ディストリビューション | 推奨ファイル | インストール手順 |
| :--- | :--- | :--- |
| Debian / Ubuntu / Mint | `RookReader_x.x.x_amd64.deb` | ダブルクリックするか、`sudo dpkg -i <ファイル名>` を実行します。 |
| Fedora / RHEL / openSUSE | `RookReader_x.x.x-x.x86_64.rpm` | `sudo dnf install <ファイル名>`（または `sudo yum install <ファイル名>`）を実行します。 |
| Arch Linux / Manjaro | `PKGBUILD` | 下の[Arch Linux 向け手順](#arch-linux-向け手順)を参照してください。 |
| その他のディストリビューション（汎用） | `RookReader_x.x.x_amd64.AppImage` | `chmod +x <ファイル名>` で実行権限を付与して起動します。 |

#### Arch Linux 向け手順

1. リポジトリの `PKGBUILD/` ディレクトリから `PKGBUILD` をダウンロードします。
2. ダウンロードしたディレクトリで以下を実行し、ビルド・インストールします。

   ```bash
   makepkg -si
   ```

> Linux での起動トラブル（WebKit2GTK の依存パッケージや Wayland 環境で AppImage が真っ白になる現象など）については、[FAQ・トラブルシューティング（英語）](https://github.com/Rookro/RookReader/wiki/FAQ-&-Troubleshooting) を参照してください。

## クイックスタート

- **本を開く:** 左ペインの**ファイルナビゲーター**で書庫・PDF・EPUB・画像フォルダをクリックするか、ウィンドウにドラッグ＆ドロップします。
- **ページをめくる:** 左クリック（次へ）／右クリック（前へ）、マウスホイール、矢印キー、`Space` キーで移動できます。
- **本棚で整理する:** 左上のボタンから**本棚**へ切り替え、コレクション・シリーズ・タグで管理できます。本棚画面へのドラッグ＆ドロップで本を追加することもできます。

![RookReader の本棚画面](../images/ja_JP/bookshelf_screenshot.png)

> キーボードショートカット一覧、見開き表示の調整、ルーペ、連続読書、しおり、各種設定の詳細は、Wiki の **[ユーザーガイド（英語）](https://github.com/Rookro/RookReader/wiki/User-Guide)** をご覧ください。

## ドキュメント・開発への参加

- **[ユーザーガイド（英語）](https://github.com/Rookro/RookReader/wiki/User-Guide)** — 詳細な操作方法、ショートカット一覧、本棚・シリーズ管理、設定リファレンス
- **[FAQ・トラブルシューティング（英語）](https://github.com/Rookro/RookReader/wiki/FAQ-&-Troubleshooting)** — データ・ログの保存先、設定復旧、Linux 向けの対処法
- **[開発者ガイド（英語）](https://github.com/Rookro/RookReader/wiki/Developer-Guide)** — アーキテクチャ概要、DevContainer／ネイティブ開発環境構築、`sqlx` マイグレーション、テスト手順
- **[コントリビューションガイド](../../CONTRIBUTING.md)** — Git Flow のブランチ運用、コーディング規約、PR 前のチェック項目
- **[変更履歴](CHANGELOG.md)** — リリースノートと最新の変更内容

バグ報告や機能提案は [GitHub Issues](https://github.com/Rookro/RookReader/issues)、コードの貢献は Pull Request でお待ちしています。

## ライセンス

このプロジェクトは [MIT License](../../LICENSE) の下で公開されています。
