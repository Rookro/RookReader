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

/**
 * Invokes a generated `commands.*` call and returns its unwrapped `data`, normalizing every
 * failure into a `CommandError`. Handles both the `Result` error-status (via {@link getDataOrThrow})
 * and a thrown rejection — the generated `typedError` re-throws `Error` instances (e.g. IPC failures)
 * instead of returning a `Result`.
 *
 * @param call - The promise returned by a generated `commands.*` function.
 * @returns The `data` payload on success.
 * @throws CommandError on any failure.
 */
export async function runCommand<T>(call: Promise<Result<T, unknown>>): Promise<T> {
  let result: Result<T, unknown>;
  try {
    result = await call;
  } catch (error) {
    throw createCommandError(error);
  }
  return getDataOrThrow(result);
}
