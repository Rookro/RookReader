/**
 * ログ設定
 */
export interface LogSettings {
    /** ログレベル */
    level: LogLevel;
}
/** 
 * ログレベル
 */
export type LogLevel = "Trace" | "Debug" | "Info" | "Warn" | "Error";
