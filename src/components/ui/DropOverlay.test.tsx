import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test/utils";
import DropOverlay from "./DropOverlay";

describe("DropOverlay", () => {
  it("shows where a drop goes while open", () => {
    renderWithProviders(<DropOverlay open message="Drop to open in the reader" />);
    expect(screen.getByText("Drop to open in the reader")).toBeVisible();
  });

  it("renders nothing while closed", () => {
    renderWithProviders(<DropOverlay open={false} message="Drop to open in the reader" />);
    expect(screen.queryByText("Drop to open in the reader")).not.toBeInTheDocument();
  });
});
