import { debug } from "@tauri-apps/plugin-log";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { perf, perfSince, perfStart, setPerfLogging } from "./perf";

vi.mock("@tauri-apps/plugin-log", () => ({
  debug: vi.fn(() => Promise.resolve()),
}));

describe("perf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setPerfLogging("info");
  });

  // Verify the guarantee: the plugin's debug() is an invoke, so a call that will be
  // discarded still costs an IPC round trip. Nothing may reach it at the shipped level.
  it("writes nothing while the level is above debug", () => {
    for (const level of ["info", "warn", "error"] as const) {
      setPerfLogging(level);
      perf("page", "entry=001.jpg source=read", 1.23);
      expect(perfStart()).toBeNull();
      expect(perfSince(null)).toBeNull();
    }

    expect(debug).not.toHaveBeenCalled();
  });

  it("writes once the reader has asked for debug", () => {
    setPerfLogging("debug");

    perf("page", "entry=001.jpg source=read", 1.234);

    // `op` first and `ms` last, so a whole distribution is one awk away.
    expect(debug).toHaveBeenCalledWith("perf op=page entry=001.jpg source=read ms=1.23");
  });

  it("writes at trace, which is below debug", () => {
    setPerfLogging("trace");

    perf("scan", "pages=200 failed=0", 7.8512);

    expect(debug).toHaveBeenCalledWith("perf op=scan pages=200 failed=0 ms=7.85");
  });

  it("measures only while it is listening", () => {
    setPerfLogging("debug");
    const started = perfStart();

    expect(started).not.toBeNull();
    expect(perfSince(started)).toBeGreaterThanOrEqual(0);
  });
});
