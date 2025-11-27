/// Archive container settings.
pub struct ContainerSettings {
    /// PDF rendering height(px).
    pub pdf_rendering_height: i32,
}

impl Default for ContainerSettings {
    fn default() -> Self {
        ContainerSettings {
            pdf_rendering_height: 2000,
        }
    }
}
