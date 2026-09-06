import { describe, expect, it } from "vitest";
import i18n from "../../i18n/config";
import { ErrorCode } from "../../types/Error";
import { type ErrorContext, formatErrorMessage } from "./errorMessages";

/** Formats in `language` regardless of the language the app is currently set to. */
const format = (language: string, context: ErrorContext, code: ErrorCode) =>
  formatErrorMessage(i18n.getFixedT(language), language, context, code);

describe("formatErrorMessage", () => {
  it("gives every error code a message", () => {
    for (const code of Object.values(ErrorCode)) {
      const message = format("en-US", "open-container", code);

      expect(message.startsWith("Failed to open book. "), message).toBe(true);
      // A missing key renders as the key itself, which is never a message.
      expect(message).not.toContain("error-message.");
    }
  });

  it("names the reason for a missing book", () => {
    expect(format("ja-JP", "open-container", ErrorCode.pathNotFound)).toBe(
      "本が開けませんでした。ファイルまたはフォルダーが見つかりません。",
    );
  });

  it("separates the two sentences with a space outside Japanese", () => {
    expect(format("en-US", "open-container", ErrorCode.pathNotFound)).toBe(
      "Failed to open book. The file or folder was not found.",
    );
  });

  it("falls back to the code number for an internal failure", () => {
    expect(format("ja-JP", "bookshelf", ErrorCode.other)).toBe(
      "本棚の操作でエラーが発生しました。(エラーコード: 90001)",
    );
  });
});
