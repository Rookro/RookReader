import { Menu, MenuItem } from "@mui/material";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useAfterCommit } from "./useAfterCommit";

/** A menu whose second item closes it and then focuses a button outside it. */
function MenuWithOutsideButton() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const outsideRef = useRef<HTMLButtonElement>(null);
  const afterCommit = useAfterCommit();
  return (
    <>
      <button type="button" onClick={(e) => setAnchor(e.currentTarget)}>
        Open
      </button>
      <button type="button" ref={outsideRef}>
        Outside
      </button>
      <Menu anchorEl={anchor} open={anchor !== null} disableRestoreFocus>
        <MenuItem>First</MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            afterCommit(() => outsideRef.current?.focus());
          }}
        >
          Close
        </MenuItem>
      </Menu>
    </>
  );
}

describe("useAfterCommit", () => {
  const user = userEvent.setup();

  it("focuses outside a closing MUI Menu once the menu has closed", async () => {
    render(<MenuWithOutsideButton />);

    await user.click(screen.getByRole("button", { name: "Open" }));
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "First" })).toHaveFocus());
    // The menu's focus trap holds focus only once focus has moved inside it.
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Close" })).toHaveFocus();
    await user.keyboard("{Enter}");

    await waitFor(() => expect(screen.getByRole("button", { name: "Outside" })).toHaveFocus());
  });

  it("runs each callback once", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result } = renderHook(() => useAfterCommit());

    act(() => result.current(first));
    act(() => result.current(second));

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
