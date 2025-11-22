use std::{
    path::Path,
    sync::{Arc, Mutex},
};

use crate::{
    container::{
        container::{Container, ContainerError},
        directory_container::DirectoryContainer,
        pdf_container::PdfContainer,
        rar_container::RarContainer,
        zip_container::ZipContainer,
    },
    setting::container_settings::ContainerSettings,
};

/// 書庫コンテナーの状態
pub struct ContainerState {
    /// 書庫コンテナー
    pub container: Option<Arc<Mutex<dyn Container>>>,
    /// 書庫コンテナーの設定
    pub settings: ContainerSettings,
}

impl Default for ContainerState {
    fn default() -> Self {
        Self {
            container: None,
            settings: ContainerSettings::default(),
        }
    }
}

impl ContainerState {
    /// コンテナーファイルを開く
    ///
    /// * `path` - コンテナーファイルのパス
    pub fn open_container(&mut self, path: &String) -> Result<(), ContainerError> {
        self.container = None;
        let file_path = Path::new(path);

        if file_path.is_dir() {
            self.container = Some(Arc::new(Mutex::new(DirectoryContainer::new(path)?)));
            return Ok(());
        }

        if let Some(ext) = file_path.extension() {
            let ext_str = ext.to_string_lossy().to_lowercase();
            match ext_str.as_str() {
                "zip" => {
                    self.container = Some(Arc::new(Mutex::new(ZipContainer::new(path)?)));
                    Ok(())
                }
                "pdf" => {
                    self.container = Some(Arc::new(Mutex::new(PdfContainer::new(
                        path,
                        self.settings.pdf_rendering_height,
                    )?)));
                    Ok(())
                }
                "rar" => {
                    self.container = Some(Arc::new(Mutex::new(RarContainer::new(path)?)));
                    Ok(())
                }
                _ => {
                    log::error!("Unsupported Container Type: {}", ext_str);
                    Err({
                        ContainerError {
                            message: format!("Unsupported Container Type: {}", ext_str),
                            path: Some(path.clone()),
                            entry: None,
                        }
                    })
                }
            }
        } else {
            log::error!("Failed to get extension. {}", path);
            Err({
                ContainerError {
                    message: format!("Failed to get extension. {}", path),
                    path: Some(path.clone()),
                    entry: None,
                }
            })
        }
    }
}
