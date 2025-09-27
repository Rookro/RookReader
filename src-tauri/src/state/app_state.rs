use crate::state::container_state::ContainerState;

/// アプリケーション全体で共有する状態
pub struct AppState {
    /// 書庫コンテナーの状態
    pub container_state: ContainerState,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            container_state: ContainerState::default(),
        }
    }
}
