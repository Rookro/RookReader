/**
 * Log settings.
 */
export interface LogSettings {
    /** Log level. */
    level: LogLevel;
}
/** 
 * Log level.
 */
export type LogLevel = "Trace" | "Debug" | "Info" | "Warn" | "Error";
