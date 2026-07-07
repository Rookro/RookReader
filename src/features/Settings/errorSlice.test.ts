import { describe, expect, it } from "vitest";
import { ErrorCode } from "../../types/Error";
import settingsErrorReducer, { clearSettingsError, setSettingsError } from "./errorSlice";

describe("settingsErrorSlice", () => {
  it("starts with no error", () => {
    expect(settingsErrorReducer(undefined, { type: "@@INIT" })).toEqual({ error: null });
  });

  it("setSettingsError records the error payload", () => {
    const payload = { code: ErrorCode.settings, message: "out of range" };

    expect(settingsErrorReducer({ error: null }, setSettingsError(payload)).error).toEqual(payload);
  });

  it("clearSettingsError resets the error", () => {
    const state = settingsErrorReducer(
      { error: { code: ErrorCode.settings, message: "x" } },
      clearSettingsError(),
    );

    expect(state.error).toBeNull();
  });
});
