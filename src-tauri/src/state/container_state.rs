use std::{
    path::Path,
    sync::{Arc, Mutex},
};

use crate::container::{
    container::{Container, ContainerError},
    pdf_container::PdfContainer,
    rar_container::RarContainer,
    zip_container::ZipContainer,
};

/// 書庫コンテナーの状態
pub struct ContainerState {
    /// 書庫コンテナー
    pub container: Option<Arc<Mutex<dyn Container>>>,
}

impl Default for ContainerState {
    fn default() -> Self {
        Self { container: None }
    }
}

impl ContainerState {
    /// コンテナーファイルを開く
    ///
    /// * `path` - コンテナーファイルのパス
    pub fn open_container(&mut self, path: &String) -> Result<(), ContainerError> {
        self.container = None;
        if let Some(ext) = Path::new(path).extension() {
            let ext_str = ext.to_string_lossy().to_lowercase();
            match ext_str.as_str() {
                "zip" => {
                    self.container = Some(Arc::new(Mutex::new(ZipContainer::new(path)?)));
                    Ok(())
                }
                "pdf" => {
                    self.container = Some(Arc::new(Mutex::new(PdfContainer::new(path)?)));
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
