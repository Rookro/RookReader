import { describe, expect, it } from "vitest";
import {
  blockSectionScripts,
  injectScriptBlockingCsp,
  SECTION_CSP,
  stripSvgScripts,
} from "./epubContentPolicy";

const XHTML = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>t</title><script>window.x=1</script></head><body><p>hi</p></body></html>`;

const metaOf = (markup: string, type: DOMParserSupportedType) =>
  new DOMParser().parseFromString(markup, type).querySelector("head")?.firstElementChild;

describe("injectScriptBlockingCsp", () => {
  it("puts the CSP meta first in an XHTML head, before any script", () => {
    const meta = metaOf(
      injectScriptBlockingCsp(XHTML, "application/xhtml+xml"),
      "application/xhtml+xml",
    );
    expect(meta?.localName).toBe("meta");
    expect(meta?.namespaceURI).toBe("http://www.w3.org/1999/xhtml");
    expect(meta?.getAttribute("http-equiv")).toBe("Content-Security-Policy");
    expect(meta?.getAttribute("content")).toBe(SECTION_CSP);
  });

  it("creates a head when the section has none", () => {
    const noHead = `<html xmlns="http://www.w3.org/1999/xhtml"><body><p>hi</p></body></html>`;
    const out = injectScriptBlockingCsp(noHead, "application/xhtml+xml");
    const doc = new DOMParser().parseFromString(out, "application/xhtml+xml");
    expect(doc.documentElement.firstElementChild?.localName).toBe("head");
    expect(metaOf(out, "application/xhtml+xml")?.getAttribute("content")).toBe(SECTION_CSP);
  });

  it("handles text/html sections", () => {
    const out = injectScriptBlockingCsp("<html><head></head><body>x</body></html>", "text/html");
    expect(metaOf(out, "text/html")?.getAttribute("content")).toBe(SECTION_CSP);
  });

  it("keeps the body content", () => {
    expect(injectScriptBlockingCsp(XHTML, "application/xhtml+xml")).toContain("<p>hi</p>");
  });

  it("puts the head before a script that precedes it", () => {
    const scriptFirst = `<html xmlns="http://www.w3.org/1999/xhtml"><script>window.x=1</script><head><title>t</title></head><body/></html>`;
    const doc = new DOMParser().parseFromString(
      injectScriptBlockingCsp(scriptFirst, "application/xhtml+xml"),
      "application/xhtml+xml",
    );
    const first = doc.documentElement.firstElementChild;
    expect(first?.localName).toBe("head");
    expect(first?.firstElementChild?.getAttribute("content")).toBe(SECTION_CSP);
  });

  it("ignores a head element from another namespace", () => {
    const foreignHead = `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:x="urn:x"><x:head/><body/></html>`;
    const doc = new DOMParser().parseFromString(
      injectScriptBlockingCsp(foreignHead, "application/xhtml+xml"),
      "application/xhtml+xml",
    );
    const first = doc.documentElement.firstElementChild;
    expect(first?.namespaceURI).toBe("http://www.w3.org/1999/xhtml");
    expect(first?.localName).toBe("head");
    expect(first?.firstElementChild?.getAttribute("content")).toBe(SECTION_CSP);
  });
});

describe("stripSvgScripts", () => {
  const SVG = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" onload="evil()"><script>evil()</script><a xlink:href="javascript:evil()"><rect onclick="evil()" width="1" height="1"/></a><foreignObject><div xmlns="http://www.w3.org/1999/xhtml"><script>evil()</script></div></foreignObject><set attributeName="href" to="javascript:evil()"/><image href="pic.png"/></svg>`;

  it("removes scripts, event handlers and javascript: URLs", () => {
    const out = stripSvgScripts(SVG, "image/svg+xml");
    expect(out).not.toContain("evil()");
    expect(out).toContain('href="pic.png"');
  });
});

describe("blockSectionScripts", () => {
  const dispatch = async (target: EventTarget, data: string, type: string) => {
    const detail = { data: data as string | Promise<string>, type };
    target.dispatchEvent(new CustomEvent("data", { detail }));
    return await detail.data;
  };

  it("rewrites XHTML sections and leaves other resources alone", async () => {
    const transformTarget = new EventTarget();
    blockSectionScripts({ transformTarget });
    expect(await dispatch(transformTarget, XHTML, "application/xhtml+xml")).toContain(SECTION_CSP);
    expect(await dispatch(transformTarget, "p{}", "text/css")).toBe("p{}");
  });

  it("matches section types whatever their case or parameters", async () => {
    const transformTarget = new EventTarget();
    blockSectionScripts({ transformTarget });
    expect(
      await dispatch(transformTarget, XHTML, "Application/XHTML+XML; charset=utf-8"),
    ).toContain(SECTION_CSP);
  });

  it("strips scripts from SVG and other XML documents", async () => {
    const transformTarget = new EventTarget();
    blockSectionScripts({ transformTarget });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><script>evil()</script></svg>`;
    expect(await dispatch(transformTarget, svg, "image/svg+xml")).not.toContain("evil()");
    const xml = `<doc xmlns:h="http://www.w3.org/1999/xhtml"><h:script>evil()</h:script></doc>`;
    expect(await dispatch(transformTarget, xml, "application/xml")).not.toContain("evil()");
  });

  it("refuses a book without a transformTarget", () => {
    expect(() => blockSectionScripts({})).toThrow("EPUB loader exposes no transformTarget");
  });
});
