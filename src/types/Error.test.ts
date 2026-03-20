import { describe, it, expect } from "vitest";
import { CommandError, createCommandError, ErrorCode } from "./Error";

describe("CommandError", () => {
  // Verify that it is created as UNKNOWN_ERROR by default
  it("should create with default unknown error", () => {
    const err = new CommandError();
    expect(err.code).toBe(ErrorCode.UNKNOWN_ERROR);
  });

  // Verify that it is created correctly with a valid error code and message
  it("should create with valid error code", () => {
    const err = new CommandError(ErrorCode.IO_ERROR, "test message");
    expect(err.code).toBe(ErrorCode.IO_ERROR);
    expect(err.message).toBe("test message");
  });

  // Verify fallback to UNKNOWN_ERROR if an invalid error code is provided
  it("should fallback to UNKNOWN_ERROR if invalid code provided", () => {
    const err = new CommandError(12345, "invalid code");
    expect(err.code).toBe(ErrorCode.UNKNOWN_ERROR);
  });

  // Verify correct handling when the error code is undefined
  it("should handle undefined code", () => {
    const err = new CommandError(undefined, "no code");
    expect(err.code).toBe(ErrorCode.UNKNOWN_ERROR);
  });
});

describe("createCommandError", () => {
  // Verify that a CommandError instance is correctly created from a valid error object
  it("should create from a valid error object", () => {
    const rawError = { code: ErrorCode.PATH_ERROR, message: "path error" };
    const err = createCommandError(rawError);
    expect(err).toBeInstanceOf(CommandError);
    expect(err.code).toBe(ErrorCode.PATH_ERROR);
    expect(err.message).toBe("path error");
  });

  // Verify fallback to UNKNOWN_ERROR when an invalid format error object is provided
  it("should fallback to UNKNOWN_ERROR for invalid error object", () => {
    const err = createCommandError("some error string");
    expect(err.code).toBe(ErrorCode.UNKNOWN_ERROR);
    expect(err.message).toContain("some error string");
  });

  // Verify appropriate fallback when an error object missing its code or message is provided
  it("should handle error object missing code or message", () => {
    const err = createCommandError({ code: 10001 }); // missing message
    expect(err.code).toBe(ErrorCode.UNKNOWN_ERROR);
  });
});
