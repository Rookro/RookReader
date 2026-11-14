import { describe, expect, it } from "vitest";
import { mockTauri } from "../test/mocks/tauri";
import { ErrorCode } from "../types/Error";
import { runBinaryCommand } from "./result";

describe("runBinaryCommand", () => {
  it("returns the command's bytes", async () => {
    const bytes = new ArrayBuffer(4);
    mockTauri.invoke.mockResolvedValue(bytes);
    await expect(runBinaryCommand("get_image", { path: "p", entryName: "e" })).resolves.toBe(bytes);
    expect(mockTauri.invoke).toHaveBeenCalledWith("get_image", { path: "p", entryName: "e" });
  });

  it("turns a failure into a CommandError", async () => {
    mockTauri.invoke.mockRejectedValue({ code: ErrorCode.pathNotFound, message: "gone" });
    await expect(runBinaryCommand("get_image", {})).rejects.toMatchObject({
      code: ErrorCode.pathNotFound,
    });
  });
});
