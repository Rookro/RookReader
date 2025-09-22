use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct Image {
    pub data: Vec<u8>,
    pub width: u32,
    pub height: u32,
}
pub trait Container {
    fn get_entries(&self) -> Result<Vec<String>, ContainerError>;
    fn get_image(&self, entry: &String) -> Result<Image, ContainerError>;
    fn preload(
        &self,
        cache: &mut HashMap<String, Image>,
        enrties: &Vec<String>,
        begin_index: usize,
        count: usize,
    ) -> Result<(), ContainerError>;
}

pub struct ContainerError {
    pub message: String,
    pub path: Option<String>,
    pub entry: Option<String>,
}
