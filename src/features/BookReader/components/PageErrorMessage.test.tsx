import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/utils";
import { ErrorCode } from "../../../types/Error";
import PageErrorMessage from "./PageErrorMessage";

describe("PageErrorMessage", () => {
  // Verify that the message names the page as what failed, and says why
  it("states that the page failed and the reason", () => {
    renderWithProviders(<PageErrorMessage code={ErrorCode.entryNotFound} width="50%" />);

    expect(screen.getByText("Failed to load the page. Page not found.")).toBeInTheDocument();
  });

  // Verify that a code with no reason worth showing still tells the reader something
  it("falls back to the code number for an internal failure", () => {
    renderWithProviders(<PageErrorMessage code={ErrorCode.other} width="100%" />);

    expect(screen.getByText("Failed to load the page. (Error code: 90001)")).toBeInTheDocument();
  });
});
