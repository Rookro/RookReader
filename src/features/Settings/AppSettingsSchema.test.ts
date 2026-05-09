import { describe, expect, it } from "vitest";
import { AppSettingsSchema } from "./AppSettingsSchema";

describe("AppSettingsSchema", () => {
  const validSettings = {
    general: {
      theme: "dark",
      appFontFamily: "Noto Sans JP",
      log: {
        level: "info",
      },
      experimentalFeatures: {},
    },
    startup: {
      initialView: "bookshelf",
      restoreLastBook: true,
      checkUpdateOnStartup: false,
    },
    bookshelf: {
      sortOrder: "name_asc",
      gridSize: 150,
      enableAutoScroll: true,
    },
    fileNavigator: {
      homeDirectory: "/home/user",
      sortOrder: "date_desc",
      watchDirectoryChanges: true,
    },
    reader: {
      comic: {
        readingDirection: "rtl",
        enableSpread: true,
        showCoverAsSinglePage: true,
        loupe: {
          zoom: 2.0,
          radius: 100,
          toggleKey: "z",
        },
        cache: {
          preloadPageCount: 10,
        },
      },
      novel: {
        fontFamily: "default-font",
        fontSize: 18,
      },
      rendering: {
        enableThumbnailPreview: true,
        maxImageHeight: 2000,
        imageResamplingMethod: "bilinear",
        pdfRenderResolutionHeight: 1080,
      },
    },
    history: {
      recordReadingHistory: true,
    },
  };

  it("should validate a correct settings object", () => {
    const result = AppSettingsSchema.safeParse(validSettings);
    expect(result.success).toBe(true);
  });

  it("should fail validation if a required field is missing", () => {
    const invalidSettings = { ...validSettings };
    // @ts-expect-error - testing invalid object
    delete invalidSettings.general;
    const result = AppSettingsSchema.safeParse(invalidSettings);
    expect(result.success).toBe(false);
  });

  it("should fail validation for invalid enum values", () => {
    const invalidSettings = {
      ...validSettings,
      general: {
        ...validSettings.general,
        theme: "invalid-theme",
      },
    };
    const result = AppSettingsSchema.safeParse(invalidSettings);
    expect(result.success).toBe(false);
  });

  it("should fail validation for incorrect types", () => {
    const invalidSettings = {
      ...validSettings,
      bookshelf: {
        ...validSettings.bookshelf,
        gridSize: "large", // Should be a number
      },
    };
    const result = AppSettingsSchema.safeParse(invalidSettings);
    expect(result.success).toBe(false);
  });

  it("should validate nested objects like loupe settings", () => {
    const invalidSettings = {
      ...validSettings,
      reader: {
        ...validSettings.reader,
        comic: {
          ...validSettings.reader.comic,
          loupe: {
            zoom: "invalid", // Should be a number
            radius: 100,
            toggleKey: "z",
          },
        },
      },
    };
    const result = AppSettingsSchema.safeParse(invalidSettings);
    expect(result.success).toBe(false);
  });

  it("should validate rendering settings enum", () => {
    const invalidSettings = {
      ...validSettings,
      reader: {
        ...validSettings.reader,
        rendering: {
          ...validSettings.reader.rendering,
          imageResamplingMethod: "invalid-method",
        },
      },
    };
    const result = AppSettingsSchema.safeParse(invalidSettings);
    expect(result.success).toBe(false);
  });
});
