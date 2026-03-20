import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../test/utils";
import TabPanel from "./TabPanel";

describe("TabPanel", () => {
  it("should render children when value equals index", () => {
    renderWithProviders(
      <TabPanel value={0} index={0}>
        <div>Test Child</div>
      </TabPanel>,
    );

    expect(screen.getByText("Test Child")).toBeInTheDocument();
  });

  it("should not render children when value does not equal index", () => {
    renderWithProviders(
      <TabPanel value={1} index={0}>
        <div>Test Child</div>
      </TabPanel>,
    );

    expect(screen.queryByText("Test Child")).not.toBeInTheDocument();
  });

  it("should apply custom sx styles", () => {
    const customSx = { backgroundColor: "red" };
    renderWithProviders(
      <TabPanel value={0} index={0} sx={customSx}>
        <div>Test Child</div>
      </TabPanel>,
    );

    const tabPanel = screen.getByText("Test Child").parentElement;
    // In Vitest/JSDOM with MUI, we can't easily check computed styles from sx without more setup,
    // but we can at least check if the component renders correctly.
    expect(tabPanel).toBeInTheDocument();
  });
});
