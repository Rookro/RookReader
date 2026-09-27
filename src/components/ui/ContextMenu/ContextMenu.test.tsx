import { MenuItem } from "@mui/material";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ContextMenu from "./ContextMenu";

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

  it("closes when the open menu is right-clicked, swallowing the native menu", () => {
    const onClose = vi.fn();
    render(
      <ContextMenu anchor={{ mouseX: 1, mouseY: 1 }} onClose={onClose}>
        <MenuItem>Item</MenuItem>
      </ContextMenu>,
    );

    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    vi.spyOn(event, "preventDefault");
    vi.spyOn(event, "stopPropagation");
    fireEvent(screen.getByRole("menu"), event);

    expect(onClose).toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
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
