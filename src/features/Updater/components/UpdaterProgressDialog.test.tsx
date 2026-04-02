import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/utils";
import UpdaterProgressDialog from "./UpdaterProgressDialog";

describe("UpdaterProgressDialog", () => {
  it("should render correctly when isUpdating is true", () => {
    renderWithProviders(
      <UpdaterProgressDialog isUpdating={true} updateProgress={50} updateStatus="Downloading..." />,
    );

    expect(screen.getByText("Downloading...")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("should not render dialog content when isUpdating is false", () => {
    renderWithProviders(
      <UpdaterProgressDialog isUpdating={false} updateProgress={0} updateStatus="" />,
    );

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
