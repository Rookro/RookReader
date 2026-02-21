use crate::state::container_state::ContainerState;

/// Represents the top-level state for the entire application.
///
/// This struct acts as a container for more specific state modules,
/// which are managed and accessed throughout the application's lifecycle.
#[derive(Default)]
pub struct AppState {
    /// Holds the state related to file/archive containers, including the currently
    /// open container and its settings.
    pub container_state: ContainerState,
}

#[cfg(test)]
mod tests {
    use crate::state::container_settings::ContainerSettings;

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
