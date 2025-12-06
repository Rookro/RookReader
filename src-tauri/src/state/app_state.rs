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

#[cfg(test)]
mod tests {
    use crate::setting::container_settings::ContainerSettings;

    use super::*;

    #[test]
    fn test_default_app_state() {
        let app_state = AppState::default();

        assert!(app_state.container_state.container.is_none());
        assert_eq!(
            ContainerSettings::default().pdf_rendering_height,
            app_state.container_state.settings.pdf_rendering_height
        );
    }

    #[test]
    fn test_app_state_container_state_is_mutable() {
        let mut app_state = AppState::default();

        app_state.container_state.settings.pdf_rendering_height = 1500;

        assert_eq!(
            1500,
            app_state.container_state.settings.pdf_rendering_height,
        );
    }
}
