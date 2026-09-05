import { debug } from "@tauri-apps/plugin-log";
import type { LogLevel } from "../types/AppSettings";

/**
 * Whether a `perf` record could be written at all.
 *
 * The plugin's `debug()` is an `invoke`, so it costs an IPC round trip **whether or not
 * the record is kept** — a level check inside the plugin comes too late to save it. The
 * level is already part of the settings the app holds, so it is mirrored here and every
 * call is gated on it: at the default level a `perf()` call is one boolean test.
 */
let enabled = false;

/**
 * Points the perf log at the level the reader has chosen.
 *
 * Called wherever settings are loaded, and again when the reader changes the level, so
 * turning debug logging on takes effect without a restart.
 *
 * @param level - The configured log level.
 */
export const setPerfLogging = (level: LogLevel): void => {
  enabled = level === "debug" || level === "trace";
};

/**
 * Writes one `perf` record, if anything is listening.
 *
 * The shape matches the backend's: `op` first, the total `ms` last, so both halves of a
 * page turn read as one stream. Durations are milliseconds.
 *
 * @param op - The event name, e.g. `display`.
 * @param fields - The event's own `key=value` text, without `op` or `ms`.
 * @param ms - How long the event took.
 */
export const perf = (op: string, fields: string, ms: number): void => {
  if (!enabled) {
    return;
  }
  void debug(`perf op=${op} ${fields} ms=${ms.toFixed(2)}`);
};

/**
 * Reads a monotonic clock, or returns null when nothing is listening.
 *
 * Mirrors the backend's span: a caller that never started cannot accidentally report a
 * duration it did not measure.
 *
 * @returns The current time, or null while perf logging is off.
 */
export const perfStart = (): number | null => (enabled ? performance.now() : null);

/**
 * Milliseconds since `started`, or null when it never started.
 *
 * @param started - The value {@link perfStart} returned.
 * @returns The elapsed milliseconds, or null.
 */
export const perfSince = (started: number | null): number | null =>
  started === null ? null : performance.now() - started;
