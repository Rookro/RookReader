import type React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { releaseMouseFocus } from "./releaseMouseFocus";

describe("releaseMouseFocus", () => {
  let button: HTMLButtonElement;

  beforeEach(() => {
    button = document.createElement("button");
    document.body.appendChild(button);
    button.focus();
  });

  afterEach(() => {
    button.remove();
  });

  it("blurs the focused element after a mouse click", () => {
    releaseMouseFocus({ detail: 1 } as React.MouseEvent);
    expect(document.activeElement).toBe(document.body);
  });

  // The clicks MUI synthesizes for Enter and Space have no click count.
  it("keeps focus after a keyboard click", () => {
    releaseMouseFocus({ detail: 0 } as React.MouseEvent);
    expect(document.activeElement).toBe(button);
  });
});
