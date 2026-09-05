import type { TFunction } from "i18next";
import { ErrorCode } from "../../types/Error";

/**
 * The operation a failure happened in. It decides the headline of the notification;
 * the {@link ErrorCode} decides the reason appended to it.
 */
export type ErrorContext =
  | "open-container"
  | "record-book"
  | "explorer"
  | "history"
  | "bookshelf"
  | "tag"
  | "series"
  | "settings-save";

/** The headline shown for each operation. */
const HEADLINE_KEY_BY_CONTEXT = {
  "open-container": "error-message.headline.open-container",
  "record-book": "error-message.headline.record-book",
  explorer: "error-message.headline.explorer",
  history: "error-message.headline.history",
  bookshelf: "error-message.headline.bookshelf",
  tag: "error-message.headline.tag",
  series: "error-message.headline.series",
  "settings-save": "error-message.headline.settings-save",
} as const satisfies Record<ErrorContext, string>;

/**
 * The reason shown for each backend error code, or `null` when the code names an
 * internal failure with nothing useful to tell the user (the code number is shown
 * instead, see {@link formatErrorMessage}).
 *
 * `satisfies Record<ErrorCode, ...>` is what keeps this honest: a new variant in
 * `src-tauri/src/error.rs` widens `ErrorCode` after `npm run gen:bindings`, and
 * `npx tsc --noEmit` then fails here until its reason is filled in.
 */
const REASON_KEY_BY_CODE = {
  [ErrorCode.unsupportedContainer]: "error-message.reason.unsupported-format",
  [ErrorCode.entryNotFound]: "error-message.reason.entry-not-found",
  [ErrorCode.emptyContainer]: "error-message.reason.empty-container",
  [ErrorCode.pdfium]: "error-message.reason.damaged",
  [ErrorCode.pdfUnavailable]: "error-message.reason.pdf-unavailable",
  [ErrorCode.image]: "error-message.reason.damaged",
  [ErrorCode.imageResize]: null,
  [ErrorCode.unrar]: "error-message.reason.damaged",
  [ErrorCode.zip]: "error-message.reason.damaged",
  [ErrorCode.epub]: "error-message.reason.damaged",
  [ErrorCode.epubArchive]: "error-message.reason.damaged",
  [ErrorCode.io]: "error-message.reason.io",
  [ErrorCode.path]: "error-message.reason.invalid-path",
  [ErrorCode.pathNotFound]: "error-message.reason.not-found",
  [ErrorCode.tauri]: null,
  [ErrorCode.rayonThreadPool]: null,
  [ErrorCode.serdeJson]: null,
  [ErrorCode.strumParse]: null,
  [ErrorCode.parseInt]: null,
  [ErrorCode.settings]: null,
  [ErrorCode.settingsValidation]: "error-message.reason.settings-validation",
  [ErrorCode.bookChanged]: "error-message.reason.book-changed",
  [ErrorCode.database]: "error-message.reason.database",
  [ErrorCode.migration]: "error-message.reason.database",
  [ErrorCode.other]: null,
  [ErrorCode.unknown]: null,
} as const satisfies Record<ErrorCode, string | null>;

/**
 * Builds the notification text for a failed operation.
 *
 * @param t - The i18n translator.
 * @param language - The active language; Japanese needs no space after its full stop.
 * @param context - The operation that failed.
 * @param code - The backend error code describing why.
 * @returns The headline for `context` followed by the reason for `code`.
 */
export function formatErrorMessage(
  t: TFunction,
  language: string,
  context: ErrorContext,
  code: ErrorCode,
): string {
  const reasonKey = REASON_KEY_BY_CODE[code];
  const reason = reasonKey ? t(reasonKey) : t("error-message.reason.unspecified", { code });
  return [t(HEADLINE_KEY_BY_CONTEXT[context]), reason].join(language.startsWith("ja") ? "" : " ");
}
