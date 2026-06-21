import { ErrorCode } from "../../types/Error";

/**
 * Maps an application {@link ErrorCode} to an i18n message key for user-facing
 * notifications. Falls back to a generic message for unmapped codes.
 *
 * @param code - The numeric error code from a `CommandError`.
 * @returns The i18n key to render with `t(...)` (a literal key union so the typed
 *   `t` accepts it).
 */
export function errorCodeToMessageKey(code: number) {
  switch (code) {
    case ErrorCode.SETTINGS_ERROR:
      return "error-message.settings.validation-failed";
    default:
      return "error-message.common.unknown";
  }
}
