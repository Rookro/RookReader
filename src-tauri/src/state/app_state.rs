use crate::state::container_state::ContainerState;

// アプリケーション全体で共有する状態
pub struct AppState {
    pub container: Option<ContainerState>,
}

impl Default for AppState {
    fn default() -> Self {
        Self { container: None }
    }
}
