/**
 * Payload of the frontend-only `locale-changed` event.
 *
 * Application language is not part of `AppSettings` (it lives in i18next + localStorage),
 * so it is synced across windows via this dedicated event rather than `settings-changed`.
 */
export interface LocaleChangedEvent {
  /** The newly selected language tag (e.g. `"en-US"`, `"ja-JP"`). */
  language: string;
}
