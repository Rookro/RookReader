import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/utils";
import SettingsPanel from "./SettingsPanel";

describe("SettingsPanel", () => {
  it("renders the title and children", () => {
    const testTitle = "Test Settings Title";
    const testChildText = "Test Child Content";

    renderWithProviders(
      <SettingsPanel title={testTitle}>
        <div>{testChildText}</div>
      </SettingsPanel>,
    );

    // Verify title rendering
    expect(screen.getByText(testTitle)).toBeInTheDocument();

    // Verify children rendering
    expect(screen.getByText(testChildText)).toBeInTheDocument();
  });

  it("applies custom styles via sx prop", () => {
    const testTitle = "Styled Panel";
    const customMargin = "20px";

    const { container } = renderWithProviders(
      <SettingsPanel title={testTitle} sx={{ margin: customMargin }} />,
    );

    // The sx prop is applied to the Container component which is the root
    const containerElement = container.firstChild as HTMLElement;
    expect(containerElement).toHaveStyle(`margin: ${customMargin}`);
  });

  it("passes other props to the Container component", () => {
    const testId = "settings-panel-container";
    renderWithProviders(<SettingsPanel title="Title" data-testid={testId} />);

    expect(screen.getByTestId(testId)).toBeInTheDocument();
  });
});
