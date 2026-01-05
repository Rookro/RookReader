/**
 * Directory entry.
 */
export type DirEntry = {
    /** Whether it is a directory. */
    is_directory: boolean,
    /** Entry name. */
    name: string,
    /** Last modified date. */
    last_modified: string,
}
