import { z } from "zod";

/**
 * Represents a series entity that groups multiple books together.
 */
export const SeriesSchema = z.object({
  /** The unique identifier for the series. */
  id: z.number(),
  /** The unique name of the series. */
  name: z.string(),
  /**
   * The timestamp when the series was created.
   * Represented as an ISO 8601 string (e.g., "2026-03-01T15:30:00").
   */
  created_at: z.string(),
});

/**
 * Represents a series entity that groups multiple books together.
 */
export type Series = z.infer<typeof SeriesSchema>;
