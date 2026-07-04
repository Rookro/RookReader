import type { SettingsValidationViolation } from "../bindings/bindings";
import { ErrorCode as BackendErrorCode } from "../bindings/errorCodes";

/**
 * Command Error interface for the application.
 */
export class CommandError extends Error {
  /** Error code for the application. */
  public readonly code: ErrorCode;

  /**
   * Structured per-field validation details, present only for
   * {@link ErrorCode.settingsValidation}. Lets the UI render a localized,
   * field-specific message (kind + valid range) instead of a generic one.
   */
  public readonly details?: SettingsValidationViolation[];

  /**
   * Constructor for the Error class.
   * @param code Error code for the application.
   * @param message Error message for the application.
   * @param details Optional structured validation details.
   */
  constructor(code?: number, message?: string, details?: SettingsValidationViolation[]) {
    super(message);
    // Keep a recognized code as-is; fall back to the frontend-only `unknown` sentinel.
    this.code =
      code !== undefined && (Object.values(ErrorCode) as number[]).includes(code)
        ? (code as ErrorCode)
        : ErrorCode.unknown;
    this.details = details;
  }
}

export function createCommandError(error: unknown): CommandError {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "number" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    const code = error.code;
    const message = error.message;
    const details =
      "details" in error && Array.isArray(error.details)
        ? (error.details as SettingsValidationViolation[])
        : undefined;
    return new CommandError(code, message, details);
  }
  const detail = error instanceof Error ? error.message : JSON.stringify(error);
  return new CommandError(ErrorCode.unknown, `Unknown error: ${detail}`);
}

/**
 * Application error codes. The backend codes are generated from Rust
 * (`../bindings/errorCodes`, the single source of truth); `unknown` is a
 * frontend-only sentinel for an unrecognized or absent code.
 */
export const ErrorCode = {
  ...BackendErrorCode,
  /** Frontend-only fallback when a code is missing or not recognized. */
  unknown: 90000,
} as const;

/**
 * Union of all application error-code values.
 */
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
