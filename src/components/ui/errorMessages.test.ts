import { describe, expect, it } from "vitest";
import { ErrorCode } from "../../types/Error";
import { errorCodeToMessageKey } from "./errorMessages";

describe("errorCodeToMessageKey", () => {
  it("maps a generic settings failure to the save-failed message", () => {
    expect(errorCodeToMessageKey(ErrorCode.settings)).toBe("error-message.settings.save-failed");
  });

  it("maps a settings validation failure to the validation-failed message", () => {
    expect(errorCodeToMessageKey(ErrorCode.settingsValidation)).toBe(
      "error-message.settings.validation-failed",
    );
  });

  it("falls back to a generic message for an unmapped code", () => {
    expect(errorCodeToMessageKey(ErrorCode.unknown)).toBe("error-message.common.unknown");
  });
});
