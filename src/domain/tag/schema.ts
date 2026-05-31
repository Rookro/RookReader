import { z } from "zod";

/**
 * Represents a tag entity used to categorize books.
 */
export const TagSchema = z.object({
  /** The unique identifier for the tag. */
  id: z.number(),
  /** The unique name of the tag. */
  name: z.string(),
  /** The color code of the tag (e.g., "#FF0000"). */
  color_code: z.string(),
});

/**
 * Represents a tag entity used to categorize books.
 */
export type Tag = z.infer<typeof TagSchema>;
