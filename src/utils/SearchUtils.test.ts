import { describe, expect, it } from "vitest";
import { andSearchBy } from "./SearchUtils";

interface Named {
  name: string;
}

describe("andSearchBy", () => {
  const items: Named[] = [
    { name: "Test Dir" },
    { name: "test_file" },
    { name: "Example" },
    { name: "another test file" },
  ];
  const getName = (item: Named) => item.name;

  it("returns the original array for an empty or whitespace-only query", () => {
    expect(andSearchBy(items, "", getName)).toBe(items);
    expect(andSearchBy(items, "   ", getName)).toBe(items);
  });

  it("matches only items containing every keyword (AND search)", () => {
    const result = andSearchBy(items, "test file", getName);
    expect(result.map(getName)).toEqual(["test_file", "another test file"]);
  });

  it("is case-insensitive", () => {
    const result = andSearchBy(items, "TEST", getName);
    expect(result.map(getName)).toEqual(["Test Dir", "test_file", "another test file"]);
  });

  it("returns an empty array when no item matches", () => {
    expect(andSearchBy(items, "missing", getName)).toEqual([]);
  });

  it("splits on full-width spaces as well", () => {
    const result = andSearchBy(items, "test　file", getName);
    expect(result.map(getName)).toEqual(["test_file", "another test file"]);
  });
});
