import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/utils";
import { useListKeyboardNavigation } from "./useListKeyboardNavigation";
import { usePointerFocusRelease } from "./usePointerFocusRelease";

/** A side panel: a focusable-only-by-script wrapper around a title, a field and a list. */
function Panel() {
  const panel = usePointerFocusRelease();
  const nav = useListKeyboardNavigation({
    rowKeys: ["a"],
    currentKey: null,
    label: "Rows",
    scrollToIndex: vi.fn(),
    pageSize: () => 1,
    onOpen: vi.fn(),
    isKeyboardInUse: true,
  });
  return (
    <section
      aria-label="Panel"
      tabIndex={-1}
      onPointerDown={panel.onPointerDown}
      onFocus={panel.onFocus}
    >
      <span>Title</span>
      <input aria-label="Search" />
      <ul {...nav.listProps}>
        <li id={nav.rowId(0)} tabIndex={-1}>
          a
        </li>
      </ul>
    </section>
  );
}

const setup = () => {
  renderWithProviders(<Panel />);
  const list = screen.getByRole("listbox");
  act(() => list.focus());
  return { list, panel: screen.getByRole("region", { name: "Panel" }) };
};

describe("usePointerFocusRelease", () => {
  it("keeps a field that a press inside the focused panel moved focus to", () => {
    setup();
    const input = screen.getByRole("textbox", { name: "Search" });

    fireEvent.pointerDown(input);
    act(() => input.focus());
    fireEvent.pointerUp(window);

    expect(document.activeElement).toBe(input);
  });

  it("releases the panel that a press on its title focused while its list had focus", () => {
    const { panel } = setup();

    fireEvent.pointerDown(screen.getByText("Title"));
    act(() => panel.focus());
    fireEvent.pointerUp(window);

    expect(panel).not.toContainElement(document.activeElement as HTMLElement);
  });

  it("releases the panel that a press focused after an earlier press got no pointerup", () => {
    renderWithProviders(<Panel />);
    const panel = screen.getByRole("region", { name: "Panel" });

    // Chromium can leave out the pointerup after some scrollbar presses.
    fireEvent.pointerDown(screen.getByText("Title"));
    fireEvent.pointerDown(screen.getByText("Title"));
    act(() => panel.focus());

    expect(document.activeElement).not.toBe(panel);
  });

  it("releases a row that a press inside the focused list focused", () => {
    const { panel } = setup();
    const row = screen.getByText("a");

    fireEvent.pointerDown(row);
    act(() => row.focus());
    fireEvent.pointerUp(window);

    expect(panel).not.toContainElement(document.activeElement as HTMLElement);
  });
});
