import { describe, expect, it } from "vitest";
import { CommandError } from "../types/Error";
import { type Result, runCommand } from "./result";

describe("runCommand", () => {
  it("returns the data payload on an ok result", async () => {
    const call = Promise.resolve<Result<number, unknown>>({ status: "ok", data: 42 });
    await expect(runCommand(call)).resolves.toBe(42);
  });

  it("throws a CommandError when the result has an error status", async () => {
    const call = Promise.resolve<Result<number, unknown>>({
      status: "error",
      error: { code: 50001, message: "boom" },
    });
    await expect(runCommand(call)).rejects.toBeInstanceOf(CommandError);
  });

  it("throws a CommandError when the call itself rejects", async () => {
    // The generated `typedError` re-throws `Error` instances instead of returning a Result.
    const call = Promise.reject(new Error("network down")) as Promise<Result<number, unknown>>;
    await expect(runCommand(call)).rejects.toBeInstanceOf(CommandError);
  });
});
