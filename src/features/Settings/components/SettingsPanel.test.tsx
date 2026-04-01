import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../test/utils";
import SettingsPanel from "./SettingsPanel";

describe("SettingsPanel", () => {
  it("should render the title and children correctly", () => {
    const testTitle = "Test Settings Section";
    const testChildText = "These are the settings items";

    renderWithProviders(
      <SettingsPanel title={testTitle}>
        <div data-testid="test-child">{testChildText}</div>
      </SettingsPanel>,
    );

    // Verify title rendering
    const titleElement = screen.getByText(testTitle);
    expect(titleElement).toBeInTheDocument();
    expect(titleElement.tagName).toBe("H6"); // Material UI Typography variant="h6"

    // Verify children rendering
    expect(screen.getByTestId("test-child")).toHaveTextContent(testChildText);
  });

  it("should apply custom sx styles without crashing", () => {
    const customSx = { marginTop: "20px" };

    expect(() => {
      renderWithProviders(
        <SettingsPanel title="Styled Panel" sx={customSx}>
          <div>Content</div>
        </SettingsPanel>,
      );
    }).not.toThrow();
  });
});
