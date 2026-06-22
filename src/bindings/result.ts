import { createCommandError } from "../types/Error";

/**
 * The result union returned by the generated `commands.*` wrappers.
 *
 * `tauri-specta` (rc.25) no longer exports a `Result` type alias from `bindings.ts`;
 * its `typedError` helper returns this shape, so we mirror it here.
 */
export type Result<T, E> = { status: "ok"; data: T } | { status: "error"; error: E };

/**
 * Unwraps a command {@link Result}, returning its `data` or throwing a `CommandError`.
 *
 * @param result - The result returned by a generated `commands.*` call.
 * @returns The `data` payload when the command succeeded.
 * @throws CommandError when the command returned an error.
 */
export function getDataOrThrow<T, E = unknown>(result: Result<T, E>): T {
  if (result.status === "error") {
    throw createCommandError(result.error);
  }
  return result.data;
}
