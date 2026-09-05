import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/utils";
import { ErrorCode } from "../../../types/Error";
import ReaderErrorOverlay from "./ReaderErrorOverlay";

describe("ReaderErrorOverlay", () => {
  // Verify that the overlay names the operation and the reason, not just one of them
  it("states both the operation and the reason", () => {
    renderWithProviders(<ReaderErrorOverlay context="load-page" code={ErrorCode.image} />);

    expect(
      screen.getByText("Failed to load the page. The file is damaged or could not be read."),
    ).toBeInTheDocument();
  });

  // Verify that a code with no reason worth showing still tells the reader something
  it("falls back to the code number for an internal failure", () => {
    renderWithProviders(<ReaderErrorOverlay context="load-novel" code={ErrorCode.other} />);

    expect(
      screen.getByText("Failed to load the book's text. (Error code: 90001)"),
    ).toBeInTheDocument();
  });
});
