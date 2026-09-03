pub mod sony_arw;

use crate::model::NormalizedRawImage;

pub trait RawAdapter: Send + Sync {
    fn name(&self) -> &'static str;
    fn can_parse(&self, bytes: &[u8]) -> bool;
    fn parse(&self, bytes: &[u8]) -> Result<NormalizedRawImage, String>;
    fn identify(&self, bytes: &[u8]) -> Option<(String, String)>; // (Make, Model)
}

pub fn get_adapter_for(bytes: &[u8]) -> Option<Box<dyn RawAdapter>> {
    let sony = sony_arw::SonyArwAdapter::new();
    if sony.can_parse(bytes) {
        return Some(Box::new(sony));
    }
    None
}
