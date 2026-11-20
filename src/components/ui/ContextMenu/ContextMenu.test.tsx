import { MenuItem } from "@mui/material";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ContextMenu from "./ContextMenu";
import type { ContextMenuAnchor } from "./useContextMenuAnchor";

function Harness({ anchor }: { anchor: ContextMenuAnchor | null }) {
  return (
    <>
      <button type="button">Outside</button>
      <ContextMenu anchor={anchor} onClose={vi.fn()}>
        <MenuItem>Item</MenuItem>
      </ContextMenu>
    </>
  );
}

describe("ContextMenu", () => {
  const user = userEvent.setup();

  it("renders nothing while the anchor is null", () => {
    render(
      <ContextMenu anchor={null} onClose={vi.fn()}>
        <MenuItem>Item</MenuItem>
      </ContextMenu>,
    );
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens at the anchor position", () => {
    render(
      <ContextMenu anchor={{ mouseX: 40, mouseY: 30 }} onClose={vi.fn()}>
        <MenuItem>Item</MenuItem>
      </ContextMenu>,
    );

    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByText("Item")).toBeInTheDocument();
    // MUI positions the paper from the anchorPosition it was given.
    const paper = screen.getByRole("menu").closest(".MuiPaper-root") as HTMLElement;
    expect(paper.style.top).toBe("30px");
    expect(paper.style.left).toBe("40px");
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    render(
      <ContextMenu anchor={{ mouseX: 1, mouseY: 1 }} onClose={onClose}>
        <MenuItem>Item</MenuItem>
      </ContextMenu>,
    );

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("passes the close reason", async () => {
    const onClose = vi.fn();
    render(
      <ContextMenu anchor={{ mouseX: 1, mouseY: 1 }} onClose={onClose}>
        <MenuItem>Item</MenuItem>
      </ContextMenu>,
    );

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledWith("escapeKeyDown");
  });

  it("closes when the open menu is right-clicked, swallowing the native menu", () => {
    const onClose = vi.fn();
    render(
      <ContextMenu anchor={{ mouseX: 1, mouseY: 1 }} onClose={onClose}>
        <MenuItem>Item</MenuItem>
      </ContextMenu>,
    );

    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 });
    vi.spyOn(event, "preventDefault");
    vi.spyOn(event, "stopPropagation");
    fireEvent(screen.getByRole("menu"), event);

    expect(onClose).toHaveBeenCalledWith("contextMenu");
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
  });

  it("stays open on a contextmenu sent from the keyboard, swallowing it", () => {
    const onClose = vi.fn();
    render(
      <ContextMenu anchor={{ mouseX: 1, mouseY: 1 }} onClose={onClose}>
        <MenuItem>Item</MenuItem>
      </ContextMenu>,
    );

    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 0 });
    vi.spyOn(event, "preventDefault");
    vi.spyOn(event, "stopPropagation");
    fireEvent(screen.getByRole("menu"), event);

    expect(onClose).not.toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
  });

  it("restores focus after a mouse anchor but not after a keyboard anchor", async () => {
    const { rerender } = render(<Harness anchor={null} />);
    const outside = screen.getByRole("button", { name: "Outside" });

    outside.focus();
    rerender(<Harness anchor={{ mouseX: 1, mouseY: 1 }} />);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    rerender(<Harness anchor={null} />);
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(outside).toHaveFocus();

    outside.focus();
    rerender(<Harness anchor={{ mouseX: 1, mouseY: 1, fromKeyboard: true }} />);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    rerender(<Harness anchor={null} />);
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(outside).not.toHaveFocus();
  });

  it("passes other Menu props through", () => {
    render(
      <ContextMenu anchor={{ mouseX: 1, mouseY: 1 }} onClose={vi.fn()} data-testid="custom-menu">
        <MenuItem>Item</MenuItem>
      </ContextMenu>,
    );
    expect(screen.getByTestId("custom-menu")).toBeInTheDocument();
  });
});
