use serde::Deserialize;
use serde_json::Value;

/// A single-category settings change.
///
/// The variant names the top-level category; the payload is a *partial* of that
/// category (only the changed leaves), expressed as a raw JSON `Value`. The backend
/// deep-merges this partial into the current settings, so untouched sibling leaves
/// are preserved. The patch is deserialize-only; it is never serialized back.
///
/// Each payload is exported to TypeScript as `unknown` (via `#[specta(type = ...)]`):
/// `serde_json::Value` is registered as an *inline* type in specta, and its recursive
/// shape cannot be inlined by the exporter. The frontend builds a typed partial and
/// casts it to `SettingsPatch`, so the looser `unknown` boundary is sufficient.
#[derive(Debug, Clone, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum SettingsPatch {
    /// A partial update to [`GeneralSettings`](crate::settings::GeneralSettings).
    General(#[specta(type = specta_typescript::Unknown)] Value),
    /// A partial update to [`StartupSettings`](crate::settings::StartupSettings).
    Startup(#[specta(type = specta_typescript::Unknown)] Value),
    /// A partial update to [`BookshelfSettings`](crate::settings::BookshelfSettings).
    Bookshelf(#[specta(type = specta_typescript::Unknown)] Value),
    /// A partial update to [`FileNavigatorSettings`](crate::settings::FileNavigatorSettings).
    FileNavigator(#[specta(type = specta_typescript::Unknown)] Value),
    /// A partial update to [`ReaderSettings`](crate::settings::ReaderSettings).
    Reader(#[specta(type = specta_typescript::Unknown)] Value),
    /// A partial update to [`HistorySettings`](crate::settings::HistorySettings).
    History(#[specta(type = specta_typescript::Unknown)] Value),
    /// A partial update to [`LayoutSettings`](crate::settings::LayoutSettings).
    Layout(#[specta(type = specta_typescript::Unknown)] Value),
}

impl SettingsPatch {
    /// Wraps the partial as `{ "<categoryCamelKey>": <partial> }`, matching the
    /// serde camelCase document so the deep merge targets only that category.
    pub(super) fn into_object(self) -> Value {
        let (key, value) = match self {
            SettingsPatch::General(v) => ("general", v),
            SettingsPatch::Startup(v) => ("startup", v),
            SettingsPatch::Bookshelf(v) => ("bookshelf", v),
            SettingsPatch::FileNavigator(v) => ("fileNavigator", v),
            SettingsPatch::Reader(v) => ("reader", v),
            SettingsPatch::History(v) => ("history", v),
            SettingsPatch::Layout(v) => ("layout", v),
        };
        serde_json::json!({ key: value })
    }
}

/// Recursively merges `patch` into `target`.
///
/// Objects merge key-by-key; any non-object value (or a key new to `target`)
/// overwrites/inserts. Used to fold a partial leaf patch into the current settings
/// while preserving untouched siblings.
pub(super) fn json_deep_merge(target: &mut Value, patch: Value) {
    match (target, patch) {
        (Value::Object(t), Value::Object(p)) => {
            for (k, pv) in p {
                json_deep_merge(t.entry(k).or_insert(Value::Null), pv);
            }
        }
        (slot, pv) => *slot = pv,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_json_deep_merge_preserves_siblings() {
        let mut target = json!({
            "reader": { "rendering": { "maxImageHeight": 0, "pdfRenderResolutionHeight": 2000 } }
        });
        json_deep_merge(
            &mut target,
            json!({ "reader": { "rendering": { "maxImageHeight": 500 } } }),
        );
        assert_eq!(target["reader"]["rendering"]["maxImageHeight"], 500);
        assert_eq!(
            target["reader"]["rendering"]["pdfRenderResolutionHeight"],
            2000
        );
    }

    #[test]
    fn test_json_deep_merge_overwrites_non_object() {
        let mut target = json!({ "a": { "b": 1 } });
        json_deep_merge(&mut target, json!({ "a": 5 }));
        assert_eq!(target["a"], 5);
    }
}
