/**
 * Command Error interface for the application.
 */
export class CommandError extends Error {
  /** Error code for the application. */
  public readonly code: ErrorCode;

  /**
   * Constructor for the Error class.
   * @param code Error code for the application.
   * @param message Error message for the application.
   */
  constructor(code?: number, message?: string) {
    super(message);
    this.code =
      code !== undefined && Object.values(ErrorCode).includes(code)
        ? code
        : ErrorCode.UNKNOWN_ERROR;
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
    return new CommandError(code, message);
  }
  return new CommandError(ErrorCode.UNKNOWN_ERROR, `Unknown error: ${JSON.stringify(error)}`);
}

/**
 * Error code for the application.
 */
export enum ErrorCode {
  /** Unknown error. */
  UNKNOWN_ERROR = 90000,

  // 1xxxx: Container Processing
  CONTAINER_UNSUPPORTED_CONTAINER_ERROR = 10001,
  CONTAINER_ENTRY_NOT_FOUND_ERROR = 10002,
  CONTAINER_PDF_ERROR = 10101,
  CONTAINER_IMAGE_ERROR = 10201,
  CONTAINER_UNRAR_ERROR = 10301,
  CONTAINER_ZIP_ERROR = 10401,
  CONTAINER_EPUB_ERROR = 10501,

  // 2xxxx: File System & I/O
  IO_ERROR = 20001,
  PATH_ERROR = 20101,

  // 3xxxx: Application Framework
  TAURI_ERROR = 30001,
  TAURI_STORE_PLUGIN_ERROR = 30101,

  // 4xxxx: Data Serialization & Validation
  SERDE_JSON_ERROR = 40001,
  STRUM_PARSE_ERROR = 40101,
  PARSE_INT_ERROR = 40201,

  // 5xxxx: Application Settings
  SETTINGS_ERROR = 50001,

  // 6xxxx: Application Logic & State
  MUTEX_ERROR = 60001,

  // 9xxxx: Unexpected Errors
  OTHER_ERROR = 90001,
}
