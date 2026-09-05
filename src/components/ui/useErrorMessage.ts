import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { ErrorCode } from "../../types/Error";
import { type ErrorContext, formatErrorMessage } from "./errorMessages";

/**
 * Provides the notification text for a failed operation.
 *
 * @returns A stable formatter taking the operation and the backend error code.
 */
export function useErrorMessage(): (context: ErrorContext, code: ErrorCode) => string {
  const { t, i18n } = useTranslation();
  return useCallback(
    (context: ErrorContext, code: ErrorCode) => formatErrorMessage(t, i18n.language, context, code),
    [t, i18n.language],
  );
}
