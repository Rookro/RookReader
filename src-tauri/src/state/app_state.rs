use crate::state::container_state::ContainerState;

/// The application state.
pub struct AppState {
    /// The container state.
    pub container_state: ContainerState,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            container_state: ContainerState::default(),
        }
    }
}
