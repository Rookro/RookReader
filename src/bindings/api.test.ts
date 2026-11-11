import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import type { Tag } from "../domain/entities";
import { CommandError, ErrorCode } from "../types/Error";
import { api } from "./api";
import { commands } from "./bindings";

vi.unmock("./api");

describe("api", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it("has every generated command", () => {
    expect(Object.keys(api).sort()).toEqual(Object.keys(commands).sort());
  });

  it("returns a command's data", async () => {
    const tags = [{ id: 1, name: "fantasy", color_code: "#ff0000" }];
    vi.mocked(invoke).mockResolvedValue(tags);

    await expect(api.getAllTags()).resolves.toEqual(tags);
    expect(invoke).toHaveBeenCalledWith("get_all_tags");
  });

  it("passes the arguments on", async () => {
    vi.mocked(invoke).mockResolvedValue(null);

    await api.deleteTag(7);
    expect(invoke).toHaveBeenCalledWith("delete_tag", { id: 7 });
  });

  it("throws a CommandError carrying the backend's code", async () => {
    vi.mocked(invoke).mockRejectedValue({ code: ErrorCode.database, message: "locked" });

    const failure = api.deleteTag(7);
    await expect(failure).rejects.toBeInstanceOf(CommandError);
    await expect(failure).rejects.toMatchObject({ code: ErrorCode.database });
  });

  it("throws a CommandError when the call itself fails", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("ipc down"));

    await expect(api.deleteTag(7)).rejects.toMatchObject({ code: ErrorCode.unknown });
  });

  it("passes through a command that returns no Result", async () => {
    vi.mocked(invoke).mockResolvedValue(true);

    await expect(api.isUpdaterSupported()).resolves.toBe(true);
  });

  it("types each command by its data", () => {
    expectTypeOf(api.getAllTags).returns.resolves.toEqualTypeOf<Tag[]>();
    expectTypeOf(api.deleteTag).parameters.toEqualTypeOf<[number]>();
    expectTypeOf(api.isUpdaterSupported).returns.resolves.toEqualTypeOf<boolean>();
  });
});
