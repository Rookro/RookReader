import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../../test/utils";
import { ItemRow } from "./ItemRow";

describe("ImageEntriesViewer/ItemRow", () => {
  const user = userEvent.setup();
  const mockEntry = "image-001.jpg";

  it("should render entry name correctly", () => {
    renderWithProviders(<ItemRow entry={mockEntry} index={0} selected={false} />);
    expect(screen.getByText("image-001.jpg")).toBeInTheDocument();
  });

  it("should show Image icon", () => {
    renderWithProviders(<ItemRow entry={mockEntry} index={0} selected={false} />);
    expect(screen.getByTestId("ImageIcon")).toBeInTheDocument();
  });

  it("should call onClick with correct arguments when clicked", async () => {
    const onClick = vi.fn();
    renderWithProviders(
      <ItemRow entry={mockEntry} index={10} selected={false} onClick={onClick} />,
    );

    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledWith(expect.anything(), 10);
  });

  it("should apply selected styles when selected is true", () => {
    renderWithProviders(<ItemRow entry={mockEntry} index={0} selected={true} />);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("Mui-selected");
  });
});
