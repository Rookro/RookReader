import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/utils";
import BookReader from "../components/BookReader";
import { isModalOpen, isTextEntryTarget } from "./guards";

describe("isTextEntryTarget", () => {
  it("recognises inputs, text areas and editable elements", () => {
    const editable = document.createElement("div");
    Object.defineProperty(editable, "isContentEditable", { value: true });
    expect(isTextEntryTarget(document.createElement("input"))).toBe(true);
    expect(isTextEntryTarget(document.createElement("textarea"))).toBe(true);
    expect(isTextEntryTarget(editable)).toBe(true);
  });

  it("treats anything else as the reader's", () => {
    expect(isTextEntryTarget(document.body)).toBe(false);
    expect(isTextEntryTarget(null)).toBe(false);
  });
});

describe("isModalOpen", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  const append = (html: string) => {
    const host = document.createElement("div");
    host.innerHTML = html;
    document.body.appendChild(host);
  };

  it("finds an open dialog, menu or MUI modal", () => {
    for (const html of ['<div role="dialog"></div>', '<div role="menu"></div>']) {
      append(html);
      expect(isModalOpen(document)).toBe(true);
      document.body.innerHTML = "";
    }
    append('<div class="MuiModal-root"></div>');
    expect(isModalOpen(document)).toBe(true);
  });

  it("ignores an element inside a hidden modal", () => {
    append('<div class="MuiModal-root MuiModal-hidden"><div role="dialog"></div></div>');
    expect(isModalOpen(document)).toBe(false);
  });
});

describe("isModalOpen in the reader", () => {
  it("finds no modal in a rendered reader view", async () => {
    renderWithProviders(<BookReader />);
    // Let the mount's async work (restoreLastBook, the File Navigator's home directory) settle.
    await screen.findByTestId("book-reader");
    await waitFor(() => expect(isModalOpen(document)).toBe(false));
  });
});
