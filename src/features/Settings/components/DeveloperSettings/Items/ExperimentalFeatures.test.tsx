import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../../test/utils";
import ExperimentalFeatures from "./ExperimentalFeatures";

describe("ExperimentalFeatures", () => {
  it("should render experimental features title and description", () => {
    renderWithProviders(<ExperimentalFeatures />);

    expect(screen.getByText(/Experimental Features/i)).toBeInTheDocument();
    expect(screen.getByText(/These features are currently under development/i)).toBeInTheDocument();
  });
});
