/**
 * Directory entry.
 */
export type DirEntry = {
    /** Whether it is a directory. */
    is_directory: Boolean,
    /** Entry name. */
    name: string,
    /** Last modified date. */
    last_modified: string,
}
