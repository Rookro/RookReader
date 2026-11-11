import { createCommandError } from "../types/Error";
import { commands } from "./bindings";
import { getDataOrThrow, type Result } from "./result";

type Commands = typeof commands;

/** A command's return type with its `Result` unwrapped; any other return type is kept. */
type Unwrapped<R> =
  Awaited<R> extends { status: "ok" | "error" }
    ? Promise<Extract<Awaited<R>, { status: "ok"; data: unknown }>["data"]>
    : R;

/** Every generated command, returning its data and throwing a `CommandError` on failure. */
export type Api = {
  [K in keyof Commands]: (...args: Parameters<Commands[K]>) => Unwrapped<ReturnType<Commands[K]>>;
};

function isResult(value: unknown): value is Result<unknown, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    (value.status === "ok" || value.status === "error")
  );
}

async function run(call: Promise<unknown>): Promise<unknown> {
  let value: unknown;
  try {
    value = await call;
  } catch (error) {
    // The generated `typedError` rethrows `Error` instances (an IPC failure) instead of
    // returning them in the result.
    throw createCommandError(error);
  }
  return isResult(value) ? getDataOrThrow(value) : value;
}

/**
 * The backend's commands. `api.getAllTags()` resolves to the tags and rejects with a
 * `CommandError`; the generated `commands.*` it wraps resolve to a `Result` instead.
 */
export const api = Object.fromEntries(
  Object.entries(commands).map(([name, command]) => [
    name,
    (...args: unknown[]) => run((command as (...args: unknown[]) => Promise<unknown>)(...args)),
  ]),
) as Api;
