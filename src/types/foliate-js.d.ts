/**
 * Type definitions for foliate-js.
 * @module foliate-js
 */

declare module "foliate-js/epub.js" {
  /**
   * Represents an item in the Table of Contents.
   */
  export interface TOCItem {
    /** The display label of the TOC item. */
    label: string;
    /** The href link to the content. */
    href: string;
    /** Optional nested subitems of the TOC item. */
    subitems?: TOCItem[];
  }

  /**
   * Represents an item in the page list.
   */
  export interface PageItem {
    /** The display label of the page. */
    label: string;
    /** The href link to the page content. */
    href: string;
  }

  /**
   * Represents a landmark item in the EPUB.
   */
  export interface LandmarkItem {
    /** The type of the landmark (e.g., 'bodymatter', 'toc'). */
    type: string;
    /** The href link to the landmark content. */
    href: string;
    /** The optional display label of the landmark. */
    label?: string;
  }

  /**
   * Book metadata structure based on foliate's normalized format.
   */
  export interface BookMetadata {
    /** The unique identifier of the book. */
    identifier?: string;
    /** The title of the book. */
    title?: string;
    /** The title to use for sorting. */
    sortAs?: string;
    /** The subtitle of the book. */
    subtitle?: string;
    /** An array of languages used in the book. */
    language?: string[];
    /** A description or summary of the book. */
    description?: string;
    /** Information about the publisher. */
    publisher?: {
      /** The name of the publisher. */
      name?: string;
      /** The name to use for sorting. */
      sortAs?: string;
      /** The role of the publisher. */
      role?: string;
      /** The code associated with the publisher. */
      code?: string;
      /** The scheme used for the publisher code. */
      scheme?: string;
    } | null;
    /** The publication date. */
    published?: string;
    /** The date the book was last modified. */
    modified?: string;
    /** The subjects or categories of the book. */
    subject?: Array<{
      /** The name of the subject. */
      name?: string;
      /** The name to use for sorting. */
      sortAs?: string;
      /** The role of the subject. */
      role?: string;
      /** The code associated with the subject. */
      code?: string;
      /** The scheme used for the subject code. */
      scheme?: string;
    } | null>;
    /** Collections or series the book belongs to. */
    belongsTo?: {
      /** Collections the book belongs to. */
      collection?: Array<{
        /** The name of the collection. */
        name?: string;
        /** The position of the book in the collection. */
        position?: number;
      }>;
      /** The series the book belongs to. */
      series?: {
        /** The name of the series. */
        name?: string;
        /** The position of the book in the series. */
        position?: number;
      } | null;
    };
    /** Alternative identifiers for the book. */
    altIdentifier?: string[];
    /** Information about the source of the book. */
    source?: string[];
    /** Rights and license information. */
    rights?: string;
    /** Additional dynamic metadata properties. */
    [key: string]: unknown;
  }

  /**
   * Represents a parsed EPUB book.
   */
  export class EPUB {
    /**
     * Constructs a new EPUB parser instance.
     *
     * @param options - Loading and hashing options.
     */
    constructor(options: {
      loadText: (uri: string) => Promise<string>;
      loadBlob: (uri: string) => Promise<Blob>;
      getSize: (uri: string) => Promise<number>;
      sha1: (buffer: ArrayBuffer) => Promise<string>;
    });

    /** The DOM parser used internally to parse XML documents. */
    parser: DOMParser;

    /** Function to load text resources by URI. */
    loadText: (uri: string) => Promise<string>;

    /** Function to load blob resources by URI. */
    loadBlob: (uri: string) => Promise<Blob>;

    /** Function to get resource size by URI. */
    getSize: (uri: string) => Promise<number>;

    /**
     * Initializes the EPUB parsing process.
     *
     * @returns A promise that resolves to the parsed EPUB instance.
     */
    init(): Promise<this>;

    /** The resources parsed from the EPUB package document. */
    resources: Resources | undefined;

    /** Target transformer function (optional). */
    transformTarget?: unknown;

    /** List of sections (spine items) in the EPUB. */
    sections:
      | Array<{
          /** The unique identifier of the section. */
          id: string;
          /** Loads the section content. */
          load: () => Promise<string | Blob>;
          /** Unloads the section content to free memory. */
          unload: () => void;
          /** Creates a DOM Document from the section content. */
          createDocument: () => Promise<Document>;
          /** The size of the section in bytes. */
          size: number;
          /** The CFI corresponding to the start of the section. */
          cfi: string;
          /** Indicates if the section is linear ('yes' or 'no'). */
          linear: string;
          /** The page spread property (e.g., 'left', 'right'). */
          pageSpread: string | undefined;
          /** Resolves a relative href against the section's base URI. */
          resolveHref: (href: string) => string;
          /** The media overlay associated with the section, if any. */
          mediaOverlay?: MediaOverlay;
        } | null>
      | undefined;

    /** The table of contents. */
    toc: TOCItem[] | undefined;

    /** The list of pages. */
    pageList: PageItem[] | undefined;

    /** The landmarks of the EPUB. */
    landmarks: LandmarkItem[] | undefined;

    /** The metadata of the EPUB book. */
    metadata: BookMetadata | undefined;

    /** The rendition settings defined in the EPUB. */
    rendition: Record<string, unknown> | undefined;

    /** Media overlay duration information. */
    media:
      | {
          /** The total duration of the media overlay. */
          duration: number;
        }
      | undefined;

    /** The base directory of the EPUB package. */
    dir: string;

    /**
     * Loads the DOM Document for the given spine item.
     *
     * @param item - The item to load.
     * @returns A promise that resolves to the loaded Document.
     */
    loadDocument(item: unknown): Promise<Document>;

    /**
     * Retrieves the MediaOverlay instance for the EPUB.
     *
     * @returns The MediaOverlay instance.
     */
    getMediaOverlay(): MediaOverlay;

    /**
     * Resolves an EPUB CFI string to an index and anchor function.
     *
     * @param cfi - The EPUB CFI string to resolve.
     * @returns An object containing the section index and an anchor resolution function.
     */
    resolveCFI(cfi: string): {
      /** The index of the section containing the CFI. */
      index: number;
      /** A function that returns the DOM Element or Range for the CFI within a given document. */
      anchor: (doc: Document) => Element | Range | null;
    };

    /**
     * Resolves a href string to an index and anchor function.
     *
     * @param href - The href string to resolve.
     * @returns An object containing the section index and an anchor resolution function, or null if not found.
     */
    resolveHref(href: string): {
      /** The index of the section containing the href. */
      index: number;
      /** A function that returns the DOM Element or Range for the href within a given document. */
      anchor: (doc: Document) => Element | Range | null;
    } | null;

    /**
     * Splits a TOC href into its base href and fragment identifier.
     *
     * @param href - The href string to split.
     * @returns A tuple containing the base href and the fragment (or null if no fragment).
     */
    splitTOCHref(href: string): [string, string | null];

    /**
     * Retrieves a fragment identifier from the document.
     *
     * @param doc - The document to search.
     * @param id - The ID of the fragment.
     * @returns The element matching the ID, or null if not found.
     */
    getTOCFragment(doc: Document, id: string): Element | null;

    /**
     * Checks if a URI is external to the EPUB.
     *
     * @param uri - The URI to check.
     * @returns True if the URI is external, false otherwise.
     */
    isExternal(uri: string): boolean;

    /**
     * Gets the cover image as a Blob.
     *
     * @returns A promise that resolves to the cover image Blob, or null if no cover exists.
     */
    getCover(): Promise<Blob | null>;

    /**
     * Gets Calibre bookmarks from the EPUB.
     *
     * @returns A promise that resolves to the Calibre bookmarks data.
     */
    getCalibreBookmarks(): Promise<unknown>;

    /**
     * Cleans up and destroys the EPUB instance, releasing memory.
     */
    destroy(): void;
  }

  /**
   * Represents resources within the EPUB.
   */
  export class Resources {
    /**
     * Constructs a Resources instance.
     *
     * @param options - Options containing opf and resolveHref.
     */
    constructor(options: {
      opf: unknown;
      resolveHref: (href: string) => string;
    });

    /** The OPF package document. */
    opf: unknown;
    /** The manifest items. */
    manifest: unknown[];
    /** The spine items. */
    spine: unknown[];
    /** The page progression direction (e.g., 'ltr', 'rtl'). */
    pageProgressionDirection: "ltr" | "rtl" | "default";
    /** The path to the navigation document. */
    navPath: string | undefined;
    /** The path to the NCX document. */
    ncxPath: string | undefined;
    /** The guide items. */
    guide:
      | Array<{
          /** The label of the guide item. */
          label: string;
          /** The type of the guide item. */
          type: string;
          /** The href of the guide item. */
          href: string;
        }>
      | undefined;
    /** The cover item reference. */
    cover: unknown | undefined;
    /** The list of CFIs. */
    cfis: string[];

    /**
     * Gets a manifest item by its ID.
     *
     * @param id - The ID of the item.
     * @returns The matching manifest item.
     */
    getItemByID(id: string): unknown;

    /**
     * Gets a manifest item by its href.
     *
     * @param href - The href of the item.
     * @returns The matching manifest item.
     */
    getItemByHref(href: string): unknown;

    /**
     * Gets a manifest item by a specific property.
     *
     * @param prop - The property to search for.
     * @returns The matching manifest item.
     */
    getItemByProperty(prop: string): unknown;

    /**
     * Resolves an EPUB CFI string to an index and anchor function.
     *
     * @param cfi - The EPUB CFI string to resolve.
     * @returns An object containing the section index and an anchor resolution function.
     */
    resolveCFI(cfi: string): {
      /** The index of the section containing the CFI. */
      index: number;
      /** A function that returns the DOM Element or Range for the CFI within a given document. */
      anchor: (doc: Document) => Element | Range | null;
    };
  }

  /**
   * Represents Media Overlay functionality.
   */
  export class MediaOverlay extends EventTarget {
    /**
     * Constructs a MediaOverlay instance.
     *
     * @param book - The EPUB book instance.
     * @param loadXML - Function to load XML documents.
     */
    constructor(book: EPUB, loadXML: (uri: string) => Promise<Document>);

    /** The EPUB book instance. */
    book: EPUB;
    /** Function to load XML documents. */
    loadXML: (uri: string) => Promise<Document>;

    /**
     * Starts playback of the media overlay.
     *
     * @param sectionIndex - The index of the section to start from.
     * @param filter - Optional filter function.
     * @returns The playback status or result.
     */
    start(sectionIndex: number, filter?: () => boolean): unknown;

    /**
     * Pauses the media overlay playback.
     */
    pause(): void;

    /**
     * Resumes the media overlay playback.
     */
    resume(): void;

    /**
     * Stops the media overlay playback.
     */
    stop(): void;

    /**
     * Moves to the previous media overlay item.
     */
    prev(): void;

    /**
     * Moves to the next media overlay item.
     */
    next(): void;

    /**
     * Sets the volume of the media overlay playback.
     *
     * @param volume - The volume level (0.0 to 1.0).
     */
    setVolume(volume: number): void;

    /**
     * Sets the playback rate of the media overlay.
     *
     * @param rate - The playback rate multiplier.
     */
    setRate(rate: number): void;
  }
}

declare module "foliate-js/epubcfi.js" {
  /** Regular expression to check if a string is a valid CFI. */
  export const isCFI: RegExp;

  /**
   * Joins multiple indirection strings into one CFI path.
   *
   * @param xs - The strings to join.
   * @returns The joined indirection string.
   */
  export function joinIndir(...xs: string[]): string;

  /**
   * Parses a CFI string into its logical components.
   *
   * @param cfi - The CFI string to parse.
   * @returns The parsed CFI components.
   */
  export function parse(cfi: string): unknown;

  /**
   * Collapses a CFI node structure.
   *
   * @param x - The node to collapse.
   * @param toEnd - Whether to collapse to the end.
   * @returns The collapsed structure.
   */
  export function collapse(x: unknown, toEnd: boolean): unknown;

  /**
   * Compares two CFI structures to determine their order.
   *
   * @param a - The first CFI structure.
   * @param b - The second CFI structure.
   * @returns A negative number if a < b, positive if a > b, 0 if equal.
   */
  export function compare(a: unknown, b: unknown): number;

  /**
   * Constructs a CFI string from a DOM Range.
   *
   * @param range - The DOM Range to convert.
   * @param filter - Optional node filter function.
   * @returns The generated CFI string.
   */
  export function fromRange(range: Range, filter?: (node: Node) => boolean): string;

  /**
   * Resolves a set of CFI parts to a DOM Range.
   *
   * @param doc - The document context.
   * @param parts - The parsed CFI parts.
   * @param filter - Optional node filter function.
   * @returns The resolved DOM Range, or null if invalid.
   */
  export function toRange(
    doc: Document,
    parts: string[],
    filter?: (node: Node) => boolean,
  ): Range | null;

  /**
   * Constructs an array of CFI strings from an array of DOM Elements.
   *
   * @param elements - The DOM elements to convert.
   * @returns An array of generated CFI strings.
   */
  export function fromElements(elements: Element[]): string[];

  /**
   * Resolves a set of CFI parts to a DOM Element.
   *
   * @param doc - The document context.
   * @param parts - The parsed CFI parts.
   * @returns The resolved DOM Element, or null if invalid.
   */
  export function toElement(doc: Document, parts: string[]): Element | null;

  /** Fake namespace for CFI operations. */
  export namespace fake {
    /**
     * Generates a fake CFI from a given index.
     *
     * @param index - The index.
     * @returns The generated fake CFI string.
     */
    export function fromIndex(index: number): string;
    /**
     * Generates an index from fake CFI parts.
     *
     * @param parts - The CFI parts.
     * @returns The extracted index.
     */
    export function toIndex(parts: string[]): number;
  }

  /**
   * Converts a Calibre position to a CFI string.
   *
   * @param pos - The Calibre position data.
   * @returns The corresponding CFI string.
   */
  export function fromCalibrePos(pos: unknown): string;

  /**
   * Converts a Calibre highlight to a CFI structure.
   *
   * @param highlight - The Calibre highlight data.
   * @returns The mapped CFI structure.
   */
  export function fromCalibreHighlight(highlight: {
    /** The index of the spine item. */
    spine_index: number;
    /** The start CFI of the highlight. */
    start_cfi: string;
    /** The end CFI of the highlight. */
    end_cfi: string;
  }): unknown;
}

declare module "foliate-js/paginator.js" {
  /** Event map for Paginator specific custom events. */
  export interface PaginatorEventMap {
    /** Fired when the paginator view is scrolled. */
    scroll: Event;
    /** Fired when the reading location changes. */
    relocate: CustomEvent<unknown>;
    /** Fired when an overlayer is created. */
    "create-overlayer": CustomEvent<unknown>;
    /** Fired when a document is loaded into the paginator. */
    load: CustomEvent<unknown>;
  }

  /**
   * Custom element representing the book paginator layout.
   */
  export class Paginator extends HTMLElement {
    /** Attributes to observe for changes. */
    static observedAttributes: string[];

    /**
     * Lifecycle callback invoked when an observed attribute changes.
     *
     * @param name - The name of the attribute.
     * @param oldValue - The previous value.
     * @param newValue - The new value.
     */
    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void;

    /**
     * Opens an EPUB book in the paginator.
     *
     * @param book - The Book instance to open.
     */
    open(book: import("foliate-js/view.js").Book): void;

    /** The base directory of the book. */
    bookDir: string;

    /** The list of section DOM elements. */
    sections: HTMLElement[];

    /** The head elements appended to the iframe documents. */
    heads: Element[] | null | undefined;

    /** The foot elements appended to the iframe documents. */
    feet: Element[] | null | undefined;

    /** The number of columns in the view. */
    columnCount: number | undefined;

    /**
     * Renders the paginator view.
     */
    render(): void;

    /** Indicates whether the view has been scrolled. */
    get scrolled(): boolean;

    /** The scroll property used (e.g., 'scrollLeft' or 'scrollTop'). */
    get scrollProp(): "scrollLeft" | "scrollTop";

    /** The dimension property used (e.g., 'height' or 'width'). */
    get sideProp(): "height" | "width";

    /** The total scrollable size of the paginator view. */
    get size(): number;

    /** The visible size of the viewport. */
    get viewSize(): number;

    /** The start offset of the current view. */
    get start(): number;

    /** The end offset of the current view. */
    get end(): number;

    /** The current page index. */
    get page(): number;

    /** The total number of pages. */
    get pages(): number;

    /** The scroll position of the container. */
    set containerPosition(newVal: number);
    get containerPosition(): number;

    /**
     * Scrolls the view by the specified horizontal and vertical distances.
     *
     * @param dx - The horizontal distance to scroll.
     * @param dy - The vertical distance to scroll.
     */
    scrollBy(dx: number, dy: number): void;

    /**
     * Snaps the view to the nearest logical snap point.
     *
     * @param vx - The horizontal velocity.
     * @param vy - The vertical velocity.
     */
    snap(vx: number, vy: number): void;

    /**
     * Scrolls the view to a specific DOM Element or Range anchor.
     *
     * @param anchor - The Element or Range to scroll to.
     * @param select - Whether to visually select the anchor.
     * @returns A promise that resolves when the scrolling is complete.
     */
    scrollToAnchor(anchor: Element | Range, select?: boolean): Promise<void>;

    /**
     * Navigates to a specific target location.
     *
     * @param target - The target location.
     * @returns A promise that resolves when navigation is complete.
     */
    goTo(
      target:
        | string
        | number
        | { index: number; anchor?: (doc: Document) => Element | Range | null },
    ): Promise<void>;

    /** Returns true if the view is at the start of the book. */
    get atStart(): boolean;

    /** Returns true if the view is at the end of the book. */
    get atEnd(): boolean;

    /**
     * Navigates backwards by the specified distance.
     *
     * @param distance - The distance to move back (default is 1 page).
     * @returns A promise that resolves when navigation is complete.
     */
    prev(distance?: number): Promise<void>;

    /**
     * Navigates forwards by the specified distance.
     *
     * @param distance - The distance to move forward (default is 1 page).
     * @returns A promise that resolves when navigation is complete.
     */
    next(distance?: number): Promise<void>;

    /**
     * Navigates to the previous section of the book.
     *
     * @returns A promise that resolves when navigation is complete.
     */
    prevSection(): Promise<void>;

    /**
     * Navigates to the next section of the book.
     *
     * @returns A promise that resolves when navigation is complete.
     */
    nextSection(): Promise<void>;

    /**
     * Navigates to the first section of the book.
     *
     * @returns A promise that resolves when navigation is complete.
     */
    firstSection(): Promise<void>;

    /**
     * Navigates to the last section of the book.
     *
     * @returns A promise that resolves when navigation is complete.
     */
    lastSection(): Promise<void>;

    /**
     * Retrieves the document and overlayer contents for the active views.
     *
     * @returns An array of active view contents.
     */
    getContents(): Array<{
      /** The index of the section. */
      index: number;
      /** The associated overlayer for annotations. */
      overlayer: unknown;
      /** The Document object of the section. */
      doc: Document;
    }>;

    /**
     * Injects CSS styles into all loaded iframe documents.
     *
     * @param styles - The CSS string to inject.
     */
    setStyles(styles: string): void;

    /**
     * Sets focus to the paginator view.
     */
    focusView(): void;

    /**
     * Destroys the paginator instance and cleans up resources.
     */
    destroy(): void;

    addEventListener<K extends keyof PaginatorEventMap>(
      type: K,
      listener: (this: Paginator, ev: PaginatorEventMap[K]) => void,
      options?: boolean | AddEventListenerOptions,
    ): void;
    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ): void;

    removeEventListener<K extends keyof PaginatorEventMap>(
      type: K,
      listener: (this: Paginator, ev: PaginatorEventMap[K]) => void,
      options?: boolean | EventListenerOptions,
    ): void;
    removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions,
    ): void;
  }
}

declare module "foliate-js/view.js" {
  /** Error thrown for invalid HTTP responses. */
  export class ResponseError extends Error {}
  /** Error thrown for not found resources. */
  export class NotFoundError extends Error {}
  /** Error thrown for unsupported types. */
  export class UnsupportedTypeError extends Error {}

  /** Represents an abstract generic book loaded by Foliate-JS. */
  export interface Book {
    /** The metadata of the book. */
    metadata?: import("foliate-js/epub.js").BookMetadata;
    /** The ordered sections comprising the book content. */
    sections?: Array<{
      /** The unique identifier of the section. */
      id?: string;
      /** Loads the section content. */
      load?: () => Promise<string | Blob>;
      /** Unloads the section content. */
      unload?: () => void;
      /** Creates a DOM document from the section content. */
      createDocument?: () => Promise<Document>;
      /** The size of the section in bytes. */
      size?: number;
      /** The CFI associated with the start of the section. */
      cfi?: string;
      /** Indicates if the section is part of the linear reading order. */
      linear?: string;
      /** The page spread specification. */
      pageSpread?: string;
      /** Resolves a relative href within the context of the section. */
      resolveHref?: (href: string) => string;
      /** The media overlay for the section. */
      mediaOverlay?: unknown;
      [key: string]: unknown;
    } | null>;
    /** The hierarchical table of contents. */
    toc?: import("foliate-js/epub.js").TOCItem[];
    /** The list of pages. */
    pageList?: import("foliate-js/epub.js").PageItem[];
    /** The landmarks within the book. */
    landmarks?: import("foliate-js/epub.js").LandmarkItem[];
    /** The base directory of the book's assets. */
    dir?: string;
    /** Rendition settings specified by the book. */
    rendition?: Record<string, unknown>;
    /** Media properties, including total duration. */
    media?: { duration?: number; [key: string]: unknown };
    /** Resolves an absolute or relative href to an index and anchor. */
    resolveHref?: (
      href: string,
    ) => { index: number; anchor: (doc: Document) => Element | Range | null } | null;
    /** Resolves a CFI string to an index and anchor. */
    resolveCFI?: (
      cfi: string,
    ) => { index: number; anchor: (doc: Document) => Element | Range | null } | null;
    /** Retrieves the DOM Element corresponding to a specific ID in a document. */
    getTOCFragment?: (doc: Document, id: string) => Element | null;
    /** Splits a TOC href into a base href and a fragment. */
    splitTOCHref?: (href: string) => [string, string | null];
    /** Retrieves the cover image of the book. */
    getCover?: () => Promise<Blob | null>;
    /** Destroys the book instance, freeing resources. */
    destroy?: () => void;
    [key: string]: unknown;
  }

  /**
   * Creates a Book instance from a file.
   *
   * @param file - The file to create the book from (e.g., File, Blob, or URL string).
   * @returns A promise that resolves to the loaded Book interface.
   */
  export function makeBook(file: File | Blob | string): Promise<Book>;

  /** Target for navigation. */
  export type NavigationTarget =
    | string
    | number
    | { index: number; anchor?: (doc: Document) => Element | Range | null };

  /** Search result item. */
  export interface SearchResult {
    /** The CFI of the search result. */
    cfi: string;
    /** The excerpt text. */
    excerpt: string;
  }

  /** Location structure representing the current reading position. */
  export interface ViewLocation {
    /** The current location CFI or NavigationTarget. */
    current?: string | NavigationTarget;
    /** Optional starting location. */
    start?: string | NavigationTarget;
    /** Optional ending location. */
    end?: string | NavigationTarget;
    /** Resolved CFI if available. */
    cfi?: string;
    /** Progress fraction overall. */
    fraction?: number;
    /** Section progress metrics. */
    section?: {
      /** The current section index. */
      current: number;
      /** The total number of sections. */
      total: number;
    };
    /** Location progress metrics. */
    location?: {
      /** The current location unit. */
      current: number;
      /** The next location unit. */
      next: number;
      /** The total number of location units. */
      total: number;
    };
    /** Time progress metrics. */
    time?: {
      /** The remaining time in the current section. */
      section: number;
      /** The total remaining time in the book. */
      total: number;
    };
    /** Current index (sometimes used directly depending on context). */
    index?: number;
    /** The current DOM Range. */
    range?: Range;
    /** The TOC item matching the current location. */
    tocItem?: import("foliate-js/epub.js").TOCItem;
    /** The Page item matching the current location. */
    pageItem?: import("foliate-js/epub.js").PageItem;
    [key: string]: unknown;
  }

  /** Event map for View specific custom events. */
  export interface ViewEventMap {
    /** Fired when the reading location changes. */
    relocate: CustomEvent<ViewLocation>;
    /** Fired when a document is fully loaded into the view. */
    load: CustomEvent<{ doc: Document; index: number }>;
    /** Fired when an external link is clicked. */
    "external-link": CustomEvent<{ a: HTMLAnchorElement; href: string }>;
    /** Fired when an internal link is clicked. */
    link: CustomEvent<{ a: HTMLAnchorElement; href: string }>;
    /** Fired to draw a specific annotation. */
    "draw-annotation": CustomEvent<{
      draw: unknown;
      annotation: unknown;
      doc: Document;
      range: Range;
    }>;
    /** Fired to show the details of an annotation. */
    "show-annotation": CustomEvent<{ value: unknown; index: number; range: Range }>;
    /** Fired when an overlay is created. */
    "create-overlay": CustomEvent<{ index: number }>;
  }

  /**
   * Custom element acting as the main viewer component.
   */
  export class View extends HTMLElement {
    /** Indicates if the book uses a fixed-layout. */
    isFixedLayout: boolean;

    /** The last recorded reading location. */
    lastLocation: ViewLocation | null;

    /** Reading history navigation manager. */
    history: History;

    /**
     * Opens a book in the viewer.
     *
     * @param book - The Book instance.
     * @returns A promise resolving when the book is fully opened and rendered.
     */
    open(book: Book): Promise<void>;

    /** The currently loaded book. */
    book: Book;

    /** Document language settings extracted from the book. */
    language:
      | {
          /** The canonical language code. */
          canonical: string;
          /** The parsed Intl.Locale object. */
          locale: Intl.Locale;
          /** True if the language is a CJK language. */
          isCJK: boolean;
          /** The text direction ('ltr', 'rtl', or 'auto'). */
          direction: "ltr" | "rtl" | "auto";
        }
      | undefined;

    /** The renderer element managing pagination or fixed-layout rendering. */
    renderer: import("foliate-js/paginator.js").Paginator | HTMLElement | undefined;

    /** The media overlay controller. */
    mediaOverlay: import("foliate-js/epub.js").MediaOverlay | undefined;

    /**
     * Closes the viewer and releases all associated resources.
     */
    close(): void;

    /** Text-to-speech engine instance. */
    tts: unknown;

    /**
     * Navigates to the start of the book text.
     *
     * @returns A promise resolving when navigation is complete.
     */
    goToTextStart(): Promise<void>;

    /**
     * Initializes the viewer state and navigates to the initial location.
     *
     * @param options - Initialization options.
     * @param options.lastLocation - The location to restore.
     * @param options.showTextStart - If true, navigates to the text start if no last location exists.
     * @returns A promise resolving when initialization is complete.
     */
    init(options: { lastLocation?: NavigationTarget; showTextStart?: boolean }): Promise<void>;

    /**
     * Adds an annotation to the view.
     *
     * @param annotation - The annotation data.
     * @param remove - If true, removes the annotation instead.
     * @returns A promise that resolves to the added annotation's metadata.
     */
    addAnnotation(
      annotation: unknown,
      remove?: boolean,
    ): Promise<
      | {
          index: number;
          label: string;
        }
      | undefined
    >;

    /**
     * Deletes an annotation from the view.
     *
     * @param annotation - The annotation data to delete.
     * @returns A promise that resolves to the deleted annotation's metadata.
     */
    deleteAnnotation(annotation: unknown): Promise<
      | {
          index: number;
          label: string;
        }
      | undefined
    >;

    /**
     * Highlights or brings an annotation into focus.
     *
     * @param annotation - The annotation to show.
     * @returns A promise resolving when the annotation is visible.
     */
    showAnnotation(annotation: unknown): Promise<void>;

    /**
     * Retrieves the CFI corresponding to a specific index and DOM Range.
     *
     * @param index - The section index.
     * @param range - The DOM Range.
     * @returns The generated CFI string.
     */
    getCFI(index: number, range?: Range): string;

    /**
     * Resolves a CFI string to a valid NavigationTarget.
     *
     * @param cfi - The CFI string.
     * @returns The resolved NavigationTarget.
     */
    resolveCFI(cfi: string): NavigationTarget;

    /**
     * Resolves an arbitrary target string to a valid NavigationTarget.
     *
     * @param target - The target string (CFI, ID, or URL).
     * @returns The resolved NavigationTarget.
     */
    resolveNavigation(target: string): NavigationTarget;

    /**
     * Navigates the viewer to a specific target location.
     *
     * @param target - The location to navigate to.
     * @returns A promise resolving when navigation is complete.
     */
    goTo(target: NavigationTarget): Promise<void>;

    /**
     * Navigates the viewer to a specific fractional location.
     *
     * @param frac - The fraction (0.0 to 1.0) of the total book length.
     * @returns A promise resolving when navigation is complete.
     */
    goToFraction(frac: number): Promise<void>;

    /**
     * Selects a target range within the document.
     *
     * @param target - The target defining the range to select.
     * @returns A promise resolving when the selection is applied.
     */
    select(target: NavigationTarget): Promise<void>;

    /**
     * Clears the current user selection.
     */
    deselect(): void;

    /**
     * Retrieves an array representing the start fraction of each section.
     *
     * @returns An array of reading fractions.
     */
    getSectionFractions(): number[];

    /**
     * Calculates the reading progress for a given index and range.
     *
     * @param index - The section index.
     * @param range - The optional DOM Range.
     * @returns An object containing corresponding TOC and Page items.
     */
    getProgressOf(
      index: number,
      range?: Range,
    ): {
      tocItem: import("foliate-js/epub.js").TOCItem | undefined;
      pageItem: import("foliate-js/epub.js").PageItem | undefined;
    };

    /**
     * Retrieves the TOC item associated with a specific navigation target.
     *
     * @param target - The navigation target.
     * @returns A promise resolving to the matching TOC item, or undefined.
     */
    getTOCItemOf(
      target: NavigationTarget,
    ): Promise<import("foliate-js/epub.js").TOCItem | undefined>;

    /**
     * Navigates backwards by the given distance.
     *
     * @param distance - The number of logical pages to move back.
     * @returns A promise resolving when navigation is complete.
     */
    prev(distance?: number): Promise<void>;

    /**
     * Navigates forwards by the given distance.
     *
     * @param distance - The number of logical pages to move forward.
     * @returns A promise resolving when navigation is complete.
     */
    next(distance?: number): Promise<void>;

    /**
     * Navigates to the logical left direction.
     *
     * @returns A promise resolving when navigation is complete.
     */
    goLeft(): Promise<void>;

    /**
     * Navigates to the logical right direction.
     *
     * @returns A promise resolving when navigation is complete.
     */
    goRight(): Promise<void>;

    /**
     * Searches the book for a given text query.
     *
     * @param opts - Search options.
     * @param opts.query - The search string.
     * @param opts.matchCase - True to perform a case-sensitive search.
     * @param opts.matchWholeWord - True to match whole words only.
     * @returns An async generator yielding search results and progress updates.
     */
    search(opts: {
      query: string;
      matchCase?: boolean;
      matchWholeWord?: boolean;
    }): AsyncGenerator<
      | "done"
      | { cfi: string; excerpt: string }
      | { progress: number; index?: undefined; subitems?: undefined }
      | { index: number; subitems: SearchResult[]; progress?: undefined }
      | { label: string; subitems: unknown }
    >;

    /**
     * Clears all active search highlights and results.
     */
    clearSearch(): void;

    /**
     * Initializes the text-to-speech engine.
     *
     * @param granularity - The granularity of speech synthesis (e.g., 'sentence').
     * @returns A promise resolving when TTS is initialized.
     */
    initTTS(granularity?: string): Promise<void>;

    /**
     * Starts playback of the media overlay.
     */
    startMediaOverlay(): void;

    addEventListener<K extends keyof ViewEventMap>(
      type: K,
      listener: (this: View, ev: ViewEventMap[K]) => void,
      options?: boolean | AddEventListenerOptions,
    ): void;
    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ): void;

    removeEventListener<K extends keyof ViewEventMap>(
      type: K,
      listener: (this: View, ev: ViewEventMap[K]) => void,
      options?: boolean | EventListenerOptions,
    ): void;
    removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions,
    ): void;
  }

  /**
   * Represents the viewing history for back/forward navigation.
   */
  export class History extends EventTarget {
    /**
     * Pushes a new state to the reading history.
     *
     * @param state - The navigation target state to push.
     */
    pushState(state: NavigationTarget): void;

    /**
     * Replaces the current state in the reading history.
     *
     * @param state - The navigation target state to set.
     */
    replaceState(state: NavigationTarget): void;

    /**
     * Navigates back in history.
     */
    back(): void;

    /**
     * Navigates forward in history.
     */
    forward(): void;

    /** True if there is a previous state in history. */
    get canGoBack(): boolean;

    /** True if there is a next state in history. */
    get canGoForward(): boolean;

    /**
     * Clears all reading history.
     */
    clear(): void;
  }
}
