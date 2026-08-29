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

  it("should title the dialog with the current phase and show the percentage once", () => {
    renderWithProviders(
      <UpdaterProgressDialog isUpdating={true} updateProgress={45} updateStatus="Downloading…" />,
    );

    expect(screen.getByText("Downloading…")).toBeInTheDocument();
    expect(screen.getByText("45%")).toBeInTheDocument();
    // The phase must not claim to install while the download is still running.
    expect(screen.queryByText("Installing…")).not.toBeInTheDocument();
  });

  it("should fall back to the installing phase when no status is set yet", () => {
    renderWithProviders(
      <UpdaterProgressDialog isUpdating={true} updateProgress={100} updateStatus="" />,
    );

    expect(screen.getByText("Installing…")).toBeInTheDocument();
  });

  it("should not render dialog content when isUpdating is false", () => {
    renderWithProviders(
      <UpdaterProgressDialog isUpdating={false} updateProgress={0} updateStatus="" />,
    );

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
