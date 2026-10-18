import type { Book } from "foliate-js/view.js";

const XHTML_NS = "http://www.w3.org/1999/xhtml";

/** The section types that can carry a `<meta>` Content Security Policy. */
const HTML_TYPES = new Set(["application/xhtml+xml", "text/html"]);

/**
 * The policy every EPUB section is rendered under: no scripts, no plugins.
 *
 * foliate-js has to give its iframes `allow-scripts` (WebKit bug 218086) and
 * `allow-same-origin`, so without a policy a script in a book runs with the app's
 * privileges.
 */
export const SECTION_CSP = "script-src 'none'; object-src 'none'";

/** A media type without parameters, lowercased: `Text/HTML; charset=utf-8` → `text/html`. */
const essenceOf = (type: string) => type.split(";")[0].trim().toLowerCase();

/** XML documents other than XHTML, which a `<meta>` policy cannot cover (SVG, plain XML). */
const isOtherXml = (essence: string) =>
  !HTML_TYPES.has(essence) &&
  (essence.endsWith("+xml") || essence === "application/xml" || essence === "text/xml");

/**
 * Prepends a `<meta>` Content Security Policy that forbids scripts to an (X)HTML section.
 *
 * The `<head>` holding it is made the first child of the root, so the policy is in
 * force before any script the section contains, wherever that script stands.
 *
 * @param markup - The section's serialized markup.
 * @param type - Its media type, `application/xhtml+xml` or `text/html`.
 * @returns The markup with {@link SECTION_CSP} as the first element of its `<head>`.
 */
export function injectScriptBlockingCsp(markup: string, type: string): string {
  const doc = new DOMParser().parseFromString(markup, essenceOf(type) as DOMParserSupportedType);
  const root = doc.documentElement;
  const head =
    Array.from(root.children).find(
      (element) => element.localName === "head" && element.namespaceURI === XHTML_NS,
    ) ?? doc.createElementNS(XHTML_NS, "head");
  root.prepend(head);
  const meta = doc.createElementNS(XHTML_NS, "meta");
  meta.setAttribute("http-equiv", "Content-Security-Policy");
  meta.setAttribute("content", SECTION_CSP);
  head.prepend(meta);
  // foliate-js serializes both section types the same way.
  return new XMLSerializer().serializeToString(doc);
}

/**
 * Removes what could run script from an SVG or other XML document: `<script>` elements
 * of any namespace, `on*` event handler attributes, and attributes holding a
 * `javascript:` URL.
 *
 * @param markup - The document's serialized markup.
 * @param type - Its media type.
 * @returns The markup without those parts.
 */
export function stripSvgScripts(markup: string, type: string): string {
  const doc = new DOMParser().parseFromString(markup, essenceOf(type) as DOMParserSupportedType);
  for (const element of Array.from(doc.getElementsByTagNameNS("*", "*"))) {
    if (element.localName === "script") {
      element.remove();
      continue;
    }
    for (const attribute of Array.from(element.attributes)) {
      if (
        attribute.localName.toLowerCase().startsWith("on") ||
        /^\s*javascript:/i.test(attribute.value)
      ) {
        element.removeAttributeNode(attribute);
      }
    }
  }
  return new XMLSerializer().serializeToString(doc);
}

/**
 * Makes every section of a book unable to run script: (X)HTML sections render under
 * {@link SECTION_CSP}, and SVG or other XML documents lose their scripts.
 *
 * Hooks foliate-js's loader, which offers each resource on `transformTarget` before
 * turning it into a blob URL. The rule lives in each document, so it holds whether or
 * not the webview applies the app's own policy to blob iframes.
 *
 * @param book - A book from `makeBook`, before it is opened in a view.
 * @throws If the book's loader cannot be hooked; the book must then not be rendered.
 */
export function blockSectionScripts(book: Book): void {
  const target = book.transformTarget;
  if (!target) {
    throw new Error("EPUB loader exposes no transformTarget");
  }
  target.addEventListener("data", (event) => {
    const { detail } = event as CustomEvent<{ data: unknown; type: string }>;
    const essence = essenceOf(detail.type);
    const transform = HTML_TYPES.has(essence)
      ? injectScriptBlockingCsp
      : isOtherXml(essence)
        ? stripSvgScripts
        : null;
    if (transform) {
      // Binary resources arrive as blobs; only parsed documents arrive as text.
      detail.data = Promise.resolve(detail.data).then((data) =>
        typeof data === "string" ? transform(data, detail.type) : data,
      );
    }
  });
}
