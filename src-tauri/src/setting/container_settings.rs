/// 書庫コンテナーの設定
pub struct ContainerSettings {
    /// PDF レンダリング時の画像高さ(px)
    pub pdf_rendering_height: i32,
}

impl Default for ContainerSettings {
    fn default() -> Self {
        ContainerSettings {
            pdf_rendering_height: 2000,
        }
    }
}
