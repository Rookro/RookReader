import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/utils";
import AdjacentBookConfirmDialog from "./AdjacentBookConfirmDialog";

describe("AdjacentBookConfirmDialog", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the title of the book to open", () => {
    renderWithProviders(
      <AdjacentBookConfirmDialog open title="Volume 2" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(screen.getByText("Volume 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("does not render content when closed", () => {
    renderWithProviders(
      <AdjacentBookConfirmDialog
        open={false}
        title="Volume 2"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByText("Volume 2")).not.toBeInTheDocument();
  });

  it("calls onConfirm when Open is clicked", async () => {
    const onConfirm = vi.fn();
    renderWithProviders(
      <AdjacentBookConfirmDialog open title="Volume 2" onConfirm={onConfirm} onCancel={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when Cancel is clicked", async () => {
    const onCancel = vi.fn();
    renderWithProviders(
      <AdjacentBookConfirmDialog open title="Volume 2" onConfirm={vi.fn()} onCancel={onCancel} />,
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
