use std::fmt::{Display, Formatter};

use serde::{Deserialize, Serialize};

/// 画像データ
#[derive(Serialize, Deserialize, Clone)]
pub struct Image {
    /// 画像のバイナリーデータ
    pub data: Vec<u8>,
    /// 画像の横幅
    pub width: u32,
    /// 画像の縦幅
    pub height: u32,
}

/// 書庫コンテナー
pub trait Container: Send + Sync + 'static {
    /// コンテナーに含まれるエントリーのリストを取得する
    fn get_entries(&self) -> &Vec<String>;

    /// 画像をキャッシュから取得する
    ///
    /// キャッシュに画像がある場合が画像を、ない場合は `None` を返す
    ///
    /// * `entry` - 取得する画像のエントリー名
    fn get_image_from_cache(&self, entry: &String) -> Result<Option<Image>, ContainerError>;

    /// 画像をファイルから取得する
    ///
    /// * `entry` - 取得する画像のエントリー名
    fn get_image(&mut self, entry: &String) -> Result<Image, ContainerError>;

    /// 指定されたインデックスから指定数分の画像をキャッシュに事前ロードする
    ///
    /// * `begin_index` - 開始インデックス
    /// * `count` - 読み込み数
    fn preload(&mut self, begin_index: usize, count: usize) -> Result<(), ContainerError>;
}

pub struct ContainerError {
    /// エラーメッセージ
    pub message: String,
    /// エラー発生時のパス
    pub path: Option<String>,
    /// エラー発生時のエントリー
    pub entry: Option<String>,
}

impl Display for ContainerError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{} (path: {}, entry: {})",
            self.message,
            self.path.clone().unwrap_or(String::from("None")),
            self.entry.clone().unwrap_or(String::from("None"))
        )?;
        Ok(())
    }
}
