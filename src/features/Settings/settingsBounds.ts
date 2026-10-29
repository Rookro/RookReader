import { SETTINGS_BOUNDS } from "../../bindings/bindings";

export { SETTINGS_BOUNDS };

/** The dotted path of a range-validated setting, e.g. `"reader.novel.fontSize"`. */
export type SettingsBoundKey = keyof typeof SETTINGS_BOUNDS;
