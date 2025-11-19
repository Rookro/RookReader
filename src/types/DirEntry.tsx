/**
 * ディレクトリエントリー
 */
export type DirEntry = {
    /** ディレクトリかどうか */
    is_directory: Boolean,
    /** エントリー名 */
    name: string,
    /** 最終更新日時 */
    last_modified: string,
}
