import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/utils";
import {
  LIST_NAVIGATION_KEYS,
  type ListKeyboardNavigation,
  type ListKeyboardNavigationOptions,
  useListKeyboardNavigation,
} from "./useListKeyboardNavigation";

type Options = ListKeyboardNavigationOptions<string>;

interface HarnessProps extends Options {
  navRef: { current: ListKeyboardNavigation<string> | null };
}

function Harness({ navRef, ...options }: HarnessProps) {
  const nav = useListKeyboardNavigation(options);
  useLayoutEffect(() => {
    navRef.current = nav;
  });
  return (
    <ul {...nav.listProps}>
      {options.rowKeys.map((key, i) => (
        <li key={key} id={nav.rowId(i)} tabIndex={-1}>
          {key}
          {i === 0 && createPortal(<button type="button">menu</button>, document.body)}
        </li>
      ))}
    </ul>
  );
}

const setup = (overrides: Partial<Options> = {}) => {
  const navRef: HarnessProps["navRef"] = { current: null };
  let props: Options = {
    rowKeys: ["a", "b", "c"],
    currentKey: null,
    label: "Rows",
    scrollToIndex: vi.fn(),
    pageSize: () => 3,
    onOpen: vi.fn(),
    onBecameEmpty: vi.fn(),
    isKeyboardInUse: true,
    ...overrides,
  };
  const utils = renderWithProviders(<Harness navRef={navRef} {...props} />);
  const nav = () => {
    if (!navRef.current) throw new Error("not rendered");
    return navRef.current;
  };
  const rerender = (next: Partial<Options>) => {
    props = { ...props, ...next };
    utils.rerender(<Harness navRef={navRef} {...props} />);
  };
  return {
    ul: screen.getByRole("listbox"),
    nav,
    rerender,
    props: () => props,
    user: userEvent.setup(),
  };
};

const tenRows = Array.from({ length: 10 }, (_, i) => `r${i}`);

describe("useListKeyboardNavigation", () => {
  it("handles exactly the pinned key set", () => {
    expect([...LIST_NAVIGATION_KEYS].sort()).toEqual([
      " ",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "End",
      "Enter",
      "Home",
      "PageDown",
      "PageUp",
    ]);
  });

  it("labels the listbox and gives rows ids from the list id", () => {
    const { ul, nav } = setup();
    expect(ul).toHaveAttribute("tabindex", "0");
    expect(ul).toHaveAttribute("aria-label", "Rows");
    expect(ul.id).toBe(nav().listProps.id);
    expect(nav().rowId(2)).toBe(`${ul.id}-row-2`);
  });

  it("moves down and up and stops at the ends", async () => {
    const { ul, nav, props, user } = setup();
    act(() => ul.focus());

    await user.keyboard("{ArrowDown}");
    expect(nav().activeKey).toBe("a");

    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(nav().activeKey).toBe("c");
    expect(props().scrollToIndex).toHaveBeenLastCalledWith(2);

    await user.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp}");
    expect(nav().activeKey).toBe("a");
    expect(nav().activeIndex).toBe(0);
    expect(props().scrollToIndex).toHaveBeenLastCalledWith(0);
  });

  it("goes to the first and last row with Home and End", async () => {
    const { ul, nav, props, user } = setup();
    act(() => ul.focus());

    await user.keyboard("{End}");
    expect(nav().activeKey).toBe("c");
    expect(props().scrollToIndex).toHaveBeenLastCalledWith(2);

    await user.keyboard("{Home}");
    expect(nav().activeKey).toBe("a");
    expect(props().scrollToIndex).toHaveBeenLastCalledWith(0);
  });

  it("moves by pageSize with PageDown and PageUp", async () => {
    const { ul, nav, user } = setup({ rowKeys: tenRows });
    act(() => ul.focus());
    act(() => nav().focusList("first"));

    await user.keyboard("{PageDown}");
    expect(nav().activeIndex).toBe(3);

    await user.keyboard("{PageUp}");
    expect(nav().activeIndex).toBe(0);

    await user.keyboard("{PageDown}{PageDown}{PageDown}{PageDown}");
    expect(nav().activeIndex).toBe(9);
  });

  it("goes to the first row with PageDown or PageUp when no row is active", async () => {
    const { ul, nav, rerender, user } = setup({ rowKeys: tenRows });
    act(() => ul.focus());

    await user.keyboard("{PageDown}");
    expect(nav().activeIndex).toBe(0);

    rerender({ rowKeys: [] });
    rerender({ rowKeys: tenRows });
    act(() => ul.focus());
    await user.keyboard("{PageUp}");
    expect(nav().activeIndex).toBe(0);
  });

  it("opens the active row with Enter", async () => {
    const { ul, props, user } = setup();
    act(() => ul.focus());

    await user.keyboard("{Enter}");
    expect(props().onOpen).not.toHaveBeenCalled();

    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(props().onOpen).toHaveBeenCalledExactlyOnceWith("b", 1);
  });

  it("prevents Space without opening", async () => {
    const { ul, nav, props, user } = setup();
    act(() => ul.focus());
    await user.keyboard("{ArrowDown}");

    expect(fireEvent.keyDown(ul, { key: " " })).toBe(false);
    expect(props().onOpen).not.toHaveBeenCalled();
    expect(nav().activeKey).toBe("a");
  });

  it("calls onEnterRow and onLeave only when given", async () => {
    const { ul, rerender, user } = setup();
    act(() => ul.focus());
    await user.keyboard("{ArrowDown}");

    expect(fireEvent.keyDown(ul, { key: "ArrowRight" })).toBe(true);
    expect(fireEvent.keyDown(ul, { key: "ArrowLeft" })).toBe(true);

    const onEnterRow = vi.fn();
    const onLeave = vi.fn();
    rerender({ onEnterRow, onLeave });

    expect(fireEvent.keyDown(ul, { key: "ArrowRight" })).toBe(false);
    expect(onEnterRow).toHaveBeenCalledExactlyOnceWith("a", 0);
    expect(fireEvent.keyDown(ul, { key: "ArrowLeft" })).toBe(false);
    expect(onLeave).toHaveBeenCalledOnce();
  });

  it("ignores keys with Ctrl, Alt or Meta and during composition", () => {
    const { ul, nav } = setup();
    act(() => ul.focus());

    expect(fireEvent.keyDown(ul, { key: "ArrowDown", ctrlKey: true })).toBe(true);
    expect(fireEvent.keyDown(ul, { key: "ArrowDown", altKey: true })).toBe(true);
    expect(fireEvent.keyDown(ul, { key: "ArrowDown", metaKey: true })).toBe(true);
    expect(fireEvent.keyDown(ul, { key: "ArrowDown", isComposing: true })).toBe(true);
    expect(nav().activeKey).toBeNull();
  });

  it("prevents only the keys it handles", () => {
    const { ul } = setup();
    act(() => ul.focus());

    expect(fireEvent.keyDown(ul, { key: "a" })).toBe(true);
    expect(fireEvent.keyDown(ul, { key: "F6" })).toBe(true);
    expect(fireEvent.keyDown(ul, { key: "ArrowDown" })).toBe(false);
  });

  it("ignores keys that bubble up from inside the list", () => {
    const { ul, nav, props } = setup();
    act(() => ul.focus());

    expect(fireEvent.keyDown(screen.getByText("b"), { key: "ArrowDown" })).toBe(true);
    expect(fireEvent.keyDown(screen.getByText("b"), { key: "Enter" })).toBe(true);
    expect(nav().activeKey).toBeNull();
    expect(props().onOpen).not.toHaveBeenCalled();
  });

  it("ignores keys from a row's portal, such as its context menu", () => {
    const { ul, nav } = setup();
    act(() => ul.focus());

    const menu = screen.getByRole("button", { name: "menu" });
    expect(ul).not.toContainElement(menu);
    expect(fireEvent.keyDown(menu, { key: "ArrowDown" })).toBe(true);
    expect(nav().activeKey).toBeNull();
  });

  it("lands on the current row and follows it until the user moves", async () => {
    const { ul, nav, props, rerender, user } = setup();

    let landed = false;
    act(() => {
      landed = nav().focusList("current");
    });
    expect(landed).toBe(true);
    expect(document.activeElement).toBe(ul);
    expect(nav().activeKey).toBe("a");

    rerender({ currentKey: "c" });
    expect(nav().activeKey).toBe("c");
    expect(props().scrollToIndex).toHaveBeenLastCalledWith(2);

    await user.keyboard("{ArrowUp}");
    expect(nav().activeKey).toBe("b");

    rerender({ currentKey: "a" });
    expect(nav().activeKey).toBe("b");
  });

  it("follows the current row once it appears in the rows", () => {
    const { nav, rerender } = setup({ rowKeys: ["a", "b"], currentKey: "c" });

    act(() => nav().focusList("current"));
    expect(nav().activeKey).toBe("a");

    rerender({ rowKeys: ["a", "b", "c"] });
    expect(nav().activeKey).toBe("c");
  });

  it("stops following the current row on a click or another request", () => {
    const { nav, rerender } = setup();

    act(() => nav().focusList("current"));
    act(() => nav().setActiveKey("b"));
    rerender({ currentKey: "c" });
    expect(nav().activeKey).toBe("b");

    act(() => nav().focusList("current"));
    expect(nav().activeKey).toBe("c");
    act(() => nav().focusList("active"));
    rerender({ currentKey: "a" });
    expect(nav().activeKey).toBe("c");
  });

  it("keeps the active row when rows shift", async () => {
    const { ul, nav, rerender, user } = setup();
    act(() => ul.focus());
    await user.keyboard("{ArrowDown}{ArrowDown}");

    rerender({ rowKeys: ["x", "a", "b", "c"] });
    expect(nav().activeKey).toBe("b");
    expect(nav().activeIndex).toBe(2);
    expect(ul).toHaveAttribute("aria-activedescendant", nav().rowId(2));
  });

  it("moves to the row now at the position of a removed row", async () => {
    const { ul, nav, rerender, user } = setup();
    act(() => ul.focus());
    await user.keyboard("{End}");

    rerender({ rowKeys: ["a", "b"] });
    expect(nav().activeKey).toBe("b");

    rerender({ rowKeys: ["a", "b", "c"] });
    await user.keyboard("{Home}{ArrowDown}");
    rerender({ rowKeys: ["a", "c"] });
    expect(nav().activeKey).toBe("c");
    expect(nav().activeIndex).toBe(1);
  });

  it("reports becoming empty only when the list had focus", () => {
    const { ul, nav, props, rerender } = setup();

    rerender({ rowKeys: [] });
    expect(props().onBecameEmpty).not.toHaveBeenCalled();

    rerender({ rowKeys: ["a", "b", "c"] });
    act(() => ul.focus());
    act(() => ul.blur());
    rerender({ rowKeys: [] });
    expect(props().onBecameEmpty).not.toHaveBeenCalled();

    rerender({ rowKeys: ["a", "b", "c"] });
    act(() => nav().focusList("first"));
    rerender({ rowKeys: [] });
    expect(props().onBecameEmpty).toHaveBeenCalledOnce();
    expect(nav().activeKey).toBeNull();
    expect(nav().activeIndex).toBe(-1);
  });

  it("lands on a given row key, or the first row when it is absent", () => {
    const { ul, nav, props } = setup();

    act(() => nav().focusList({ rowKey: "b" }));
    expect(document.activeElement).toBe(ul);
    expect(nav().activeKey).toBe("b");
    expect(props().scrollToIndex).toHaveBeenLastCalledWith(1);

    act(() => nav().focusList({ rowKey: "zz" }));
    expect(nav().activeKey).toBe("a");

    act(() => nav().setActiveKey("c"));
    act(() => nav().focusList("active"));
    expect(nav().activeKey).toBe("c");

    act(() => nav().focusList("first"));
    expect(nav().activeKey).toBe("a");
  });

  it("returns false and focuses nothing for an empty list", () => {
    const { ul, nav, props } = setup({ rowKeys: [] });

    let landed = true;
    act(() => {
      landed = nav().focusList("first");
    });
    expect(landed).toBe(false);
    expect(document.activeElement).toBe(document.body);
    expect(props().scrollToIndex).not.toHaveBeenCalled();

    act(() => ul.focus());
    expect(fireEvent.keyDown(ul, { key: "ArrowDown" })).toBe(true);
  });

  it("draws the active row as keyboard-focused only while focused and isKeyboardInUse", () => {
    const { ul, nav, rerender } = setup();

    act(() => nav().setActiveKey("b"));
    expect(nav().isKeyboardActive(1)).toBe(false);

    act(() => ul.focus());
    expect(nav().hasFocus).toBe(true);
    expect(nav().isKeyboardActive(1)).toBe(true);
    expect(nav().isKeyboardActive(0)).toBe(false);

    rerender({ isKeyboardInUse: false });
    expect(nav().isKeyboardActive(1)).toBe(false);

    rerender({ isKeyboardInUse: true });
    act(() => screen.getByText("a").focus());
    expect(nav().hasFocus).toBe(false);
    expect(nav().isKeyboardActive(1)).toBe(false);
  });

  it("blurs itself when focused by a pointer", () => {
    const { ul, nav } = setup();

    fireEvent.pointerDown(ul);
    act(() => ul.focus());
    expect(document.activeElement).not.toBe(ul);
    expect(nav().hasFocus).toBe(false);

    act(() => ul.focus());
    expect(document.activeElement).toBe(ul);
  });

  it("keeps a later keyboard focus after a pointer press that did not focus the list", () => {
    const { ul, nav } = setup();

    fireEvent.pointerDown(screen.getByText("b"));
    act(() => screen.getByText("b").focus());
    act(() => ul.focus());
    expect(document.activeElement).toBe(ul);

    fireEvent.pointerDown(ul);
    act(() => ul.blur());
    act(() => ul.focus());
    expect(document.activeElement).toBe(ul);

    act(() => ul.blur());
    fireEvent.pointerDown(ul);
    act(() => nav().focusList("first"));
    expect(document.activeElement).toBe(ul);
  });

  it("releases focus on pointerup after a press inside the focused list", () => {
    const { ul, nav } = setup();
    act(() => nav().focusList("first"));

    fireEvent.pointerDown(ul);
    expect(document.activeElement).toBe(ul);
    fireEvent.pointerUp(window);
    expect(document.activeElement).not.toBe(ul);
    expect(nav().hasFocus).toBe(false);
  });

  it("keeps focus during a drag and after a cancelled press", () => {
    const { ul, nav } = setup();
    act(() => nav().focusList("first"));

    fireEvent.pointerDown(ul);
    fireEvent.pointerMove(window);
    expect(document.activeElement).toBe(ul);

    fireEvent.pointerCancel(window);
    fireEvent.pointerUp(window);
    expect(document.activeElement).toBe(ul);
  });

  it("releases a focused row on pointerup and keeps the next keyboard focus", () => {
    const { ul, nav } = setup();
    const row = screen.getByText("b");
    act(() => row.focus());

    fireEvent.pointerDown(row);
    fireEvent.pointerUp(window);
    expect(document.activeElement).toBe(document.body);

    act(() => nav().focusList("first"));
    expect(document.activeElement).toBe(ul);
    act(() => ul.blur());
    act(() => ul.focus());
    expect(document.activeElement).toBe(ul);
  });

  it("points aria-activedescendant at the active row only while it is rendered", () => {
    const { ul, nav } = setup({ rowKeys: tenRows });
    expect(ul).not.toHaveAttribute("aria-activedescendant");

    act(() => nav().setActiveKey("r5"));
    expect(ul).toHaveAttribute("aria-activedescendant", screen.getByText("r5").id);

    act(() =>
      nav().onRowsRendered({ startIndex: 0, stopIndex: 2 }, { startIndex: 0, stopIndex: 2 }),
    );
    expect(ul).not.toHaveAttribute("aria-activedescendant");

    act(() => nav().setActiveKey("r1"));
    expect(ul).toHaveAttribute("aria-activedescendant", screen.getByText("r1").id);
  });
});
