/**
 * Type definitions for foliate-js.
 * Based on the implementation in node_modules/foliate-js.
 */

declare module "foliate-js/view.js" {
  /**
   * Represents the destination referenced by an href.
   */
  export interface ResolvedLocation {
    /** The index of the referenced section in the .sections array */
    index: number;
    /** Returns the document fragment referred to by the href */
    anchor?(doc: Document): Element | Range | null;
  }

  /**
   * A section of the book.
   */
  export interface BookSection {
    /** Returns a string containing the URL that will be rendered. */
    load(): string | Promise<string>;
    /** Frees the section. */
    unload?(): void;
    /** Returns a Document object of the section. */
    createDocument?(): Document | Promise<Document>;
    /** The byte size of the section. */
    size?: number;
    /** Whether the section is part of the linear reading sequence. */
    linear?: "yes" | "no";
    /** Base CFI string of the section. */
    cfi?: string;
    /** An identifier for the section. */
    id?: string;
  }

  /**
   * Represents a table of contents item.
   */
  export interface TOCItem {
    /** A string label for the item. */
    label: string;
    /** A string representing the destination of the item. */
    href: string;
    /** An array that contains sub TOC items. */
    subitems?: TOCItem[];
  }

  /**
   * The main interface for books.
   */
  export interface Book {
    /** An array of sections in the book. */
    sections?: BookSection[];
    /** The page progression direction of the book. */
    dir?: "rtl" | "ltr";
    /** An array representing the table of contents of the book. */
    toc?: TOCItem[];
    /** An array representing the page list of the book. */
    pageList?: TOCItem[];
    /** An object representing the metadata of the book. */
    metadata?: unknown;
    /** An object that contains rendition properties. */
    rendition?: unknown;
    /** Resolves an href string to a destination object. */
    resolveHref?(href: string): ResolvedLocation | null;
    /** Resolves a CFI string to a destination object. */
    resolveCFI?(cfi: string): ResolvedLocation | null;
    /** Returns whether the link should be opened externally. */
    isExternal?(href: string): boolean;
    /** Splits an href string from the TOC into an id and a fragment identifier. */
    splitTOCHref?(href: string): Promise<[string, unknown]> | [string, unknown];
    /** Returns a Node representing the target linked by the TOC item. */
    getTOCFragment?(doc: Document, id: string): Node;
    /** An EventTarget used to transform the contents of the book as it loads. */
    transformTarget?: EventTarget;
  }

  /**
   * Opens a File, Blob, or URL and returns a Book object.
   * @param file The file, blob, or string URL to open.
   * @returns A promise that resolves to a Book object.
   */
  export function makeBook(file: File | Blob | string): Promise<Book>;

  export class ResponseError extends Error {}
  export class NotFoundError extends Error {}
  export class UnsupportedTypeError extends Error {}

  export interface RelocateEventDetail {
    range?: Range;
    fraction?: number;
    section?: {
      current: number;
      total: number;
    };
    location?: {
      current: number;
      next: number;
      total: number;
    };
    time?: {
      section: number;
      total: number;
    };
    tocItem?: TOCItem;
    pageItem?: TOCItem;
    cfi?: string;
  }

  /**
   * The main view element for rendering books.
   */
  export class View extends HTMLElement {
    /** Whether the view uses a fixed layout renderer. */
    isFixedLayout: boolean;
    /** The last recorded location. */
    lastLocation: RelocateEventDetail | undefined;
    /** The history of navigation. */
    history: unknown;
    /** The underlying renderer element. */
    renderer: HTMLElement & {
      goTo(target: string | { index: number; anchor?: unknown }): Promise<void>;
      prev(): Promise<void>;
      next(): Promise<void>;
    };

    /**
     * Opens a book.
     * @param book A Book object, File, Blob, or string URL.
     */
    open(book: Book | File | Blob | string): Promise<void>;

    /**
     * Navigates to a specific path, section index, or CFI.
     * @param target The target location.
     */
    goTo(target: string | number | { index: number; anchor?: unknown }): Promise<void>;

    addEventListener<K extends keyof ViewEventMap>(
      type: K,
      listener: (this: View, ev: ViewEventMap[K]) => unknown,
      options?: boolean | AddEventListenerOptions,
    ): void;
    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ): void;
    removeEventListener<K extends keyof ViewEventMap>(
      type: K,
      listener: (this: View, ev: ViewEventMap[K]) => unknown,
      options?: boolean | EventListenerOptions,
    ): void;
    removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions,
    ): void;
  }

  export interface ViewEventMap extends HTMLElementEventMap {
    relocate: CustomEvent<RelocateEventDetail>;
    load: CustomEvent<{ doc: Document; index: number }>;
    "create-overlayer": CustomEvent<{
      doc: Document;
      index: number;
      attach: (overlay: unknown) => void;
    }>;
  }
}

declare module "foliate-js/epub.js" {
  import type { Book } from "foliate-js/view.js";

  export interface Loader {
    entries?: { filename: string }[];
    loadText(filename: string): Promise<string> | string;
    loadBlob(filename: string): Promise<Blob> | Blob;
    getSize(filename: string): number;
  }

  /**
   * Parses and loads EPUB files.
   */
  export class EPUB implements Book {
    constructor(loader: Loader & { sha1?: (data: Uint8Array) => Promise<Uint8Array> });
    /** Initializes the EPUB book. */
    init(): Promise<Book>;
  }
}

declare module "foliate-js/paginator.js" {
  import type { Book } from "foliate-js/view.js";

  /**
   * Renderer for reflowable books.
   */
  export class Paginator extends HTMLElement {
    /** Opens a book object. */
    open(book: Book): Promise<void>;
    /** Navigates to a destination. */
    goTo(target: { index: number; anchor?: unknown }): Promise<void>;
    /** Goes to the previous page. */
    prev(): Promise<void>;
    /** Goes to the next page. */
    next(): Promise<void>;
  }
}

declare module "foliate-js/fixed-layout.js" {
  import type { Book } from "foliate-js/view.js";

  /**
   * Renderer for fixed layout books.
   */
  export class FixedLayout extends HTMLElement {
    /** Opens a book object. */
    open(book: Book): Promise<void>;
    /** Navigates to a destination. */
    goTo(target: { index: number; anchor?: unknown }): Promise<void>;
    /** Goes to the previous page. */
    prev(): Promise<void>;
    /** Goes to the next page. */
    next(): Promise<void>;
  }
}

declare module "foliate-js/epubcfi.js" {
  export const isCFI: RegExp;
  export function joinIndir(...xs: string[]): string;
  export function parse(cfi: string): unknown;
  export function collapse(x: unknown, toEnd?: boolean): unknown;
  export function compare(a: unknown, b: unknown): number;
  export function fromRange(range: Range, filter?: unknown): string;
  export function toRange(doc: Document, parts: unknown, filter?: unknown): Range;
  export function fromElements(elements: Element[]): string[];
  export function toElement(doc: Document, parts: unknown): Element;
  export const fake: {
    fromIndex(index: number): string;
    toIndex(parts: unknown): number;
  };
  export function fromCalibrePos(pos: string): string;
  export function fromCalibreHighlight(highlight: unknown): string;
}

declare module "foliate-js/comic-book.js" {
  import type { Book } from "foliate-js/view.js";
  export function makeComicBook(loader: unknown, file: File | Blob): Promise<Book> | Book;
}

declare module "foliate-js/fb2.js" {
  import type { Book } from "foliate-js/view.js";
  export function makeFB2(blob: Blob): Promise<Book>;
}

declare module "foliate-js/mobi.js" {
  export function isMOBI(file: File | Blob): Promise<boolean>;
  export class MOBI {
    constructor(opts?: { unzlib?: unknown });
    open(file: File | Blob): Promise<void>;
  }
}

declare module "foliate-js/progress.js" {
  export class TOCProgress {
    init(opts: {
      toc: unknown;
      ids: unknown;
      splitHref: unknown;
      getFragment: unknown;
    }): Promise<void>;
    getProgress(index: number, range: Range): unknown;
  }
  export class SectionProgress {
    constructor(sections: unknown[], sizePerLoc: number, sizePerTimeUnit: number);
    getProgress(index: number, fractionInSection: number, pageFraction?: number): unknown;
  }
}

declare module "foliate-js/overlayer.js" {
  /**
   * Adds an overlay to the page.
   */
  export class Overlayer {
    constructor(doc: Document);
    /** The SVG element representing the overlay. */
    get element(): SVGElement;
  }
}
