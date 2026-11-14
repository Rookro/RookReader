/**
 * Directory entry.
 */
export type DirEntry = {
  /** Whether it is a directory. */
  isDirectory: boolean;
  /** Entry name. */
  name: string;
  /** Last modified time as a raw timestamp (ms), as sent by the backend. */
  lastModified: number;
};
