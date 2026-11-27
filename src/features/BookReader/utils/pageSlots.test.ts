import { describe, expect, it } from "vitest";
import { ErrorCode } from "../../../types/Error";
import { ImageCacheItem, type ViewLayout } from "./ImageUtils";
import { pageSlots } from "./pageSlots";

const image = (url: string) => new ImageCacheItem(100, 200, undefined, url);

describe("pageSlots", () => {
  it("puts a single page in the full width, centred", () => {
    const layout: ViewLayout = {
      firstImage: image("blob:a"),
      firstEntry: "a.jpg",
      isSpread: false,
      nextIndexIncrement: 1,
    };

    expect(pageSlots(layout, "rtl")).toEqual([
      {
        role: "single",
        entry: "a.jpg",
        url: "blob:a",
        error: undefined,
        left: 0,
        width: 1,
        align: "center",
      },
    ]);
  });

  it("puts the first page right in a right-to-left spread, each pushed to the spine", () => {
    const layout: ViewLayout = {
      firstImage: image("blob:a"),
      firstEntry: "a.jpg",
      secondImage: image("blob:b"),
      secondEntry: "b.jpg",
      isSpread: true,
      nextIndexIncrement: 2,
    };

    expect(pageSlots(layout, "rtl")).toEqual([
      {
        role: "left",
        entry: "b.jpg",
        url: "blob:b",
        error: undefined,
        left: 0,
        width: 0.5,
        align: "end",
      },
      {
        role: "right",
        entry: "a.jpg",
        url: "blob:a",
        error: undefined,
        left: 0.5,
        width: 0.5,
        align: "start",
      },
    ]);
    expect(pageSlots(layout, "ltr").map((slot) => slot.entry)).toEqual(["a.jpg", "b.jpg"]);
  });

  it("keeps a failed page's place with its error and no image", () => {
    const layout: ViewLayout = {
      firstImage: image("blob:a"),
      firstEntry: "a.jpg",
      secondError: ErrorCode.image,
      secondEntry: "b.jpg",
      isSpread: true,
      nextIndexIncrement: 2,
    };

    const [left] = pageSlots(layout, "rtl");
    expect(left).toMatchObject({
      role: "left",
      entry: "b.jpg",
      url: undefined,
      error: ErrorCode.image,
    });
  });
});
