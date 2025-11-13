use std::{
    fmt::{Display, Formatter},
    io::Cursor,
    sync::Arc,
};

use image::ImageReader;
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

impl Image {
    pub fn new(data: Vec<u8>) -> Result<Self, String> {
        let cursor = Cursor::new(&data);
        let image_reader = ImageReader::new(cursor)
            .with_guessed_format()
            .map_err(|e| format!("Failed to create Image instance. {}", e))?;
        match image_reader.into_dimensions() {
            Ok((width, height)) => Ok(Image {
                data: data,
                width,
                height,
            }),
            Err(e) => {
                let error_message = format!("Failed to get image size. {}", e);
                log::error!("{}", error_message);
                return Err(error_message);
            }
        }
    }
}

/// 書庫コンテナー
pub trait Container: Send + Sync + 'static {
    /// コンテナーに含まれるエントリーのリストを取得する
    fn get_entries(&self) -> &Vec<String>;

    /// 画像をキャッシュから取得する
    ///
    /// キャッシュに画像がある場合は Arc<Image> を返す
    ///
    /// * `entry` - 取得する画像のエントリー名
    fn get_image_from_cache(&self, entry: &String) -> Result<Option<Arc<Image>>, ContainerError>;

    /// 画像をファイルから取得する
    ///
    /// * `entry` - 取得する画像のエントリー名
    fn get_image(&mut self, entry: &String) -> Result<Arc<Image>, ContainerError>;

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
