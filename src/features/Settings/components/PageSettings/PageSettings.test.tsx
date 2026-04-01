import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../test/utils";
import PageSettings from "./PageSettings";
import { JSX } from "react";

// Mock sub-components
vi.mock("./Items/ShowCoverAsSinglePageSetting", () => {
  const ShowCoverAsSinglePageSetting = (): JSX.Element => (
    <div data-testid="show-cover-as-single-page-setting" />
  );
  ShowCoverAsSinglePageSetting.displayName = "ShowCoverAsSinglePageSetting";
  return { default: ShowCoverAsSinglePageSetting };
});

// Mock SettingsPanel
vi.mock("../SettingsPanel", () => {
  const SettingsPanel = ({
    title,
    children,
  }: {
    title: string;
    children?: React.ReactNode;
  }): JSX.Element => (
    <div data-testid="settings-panel">
      <h2 data-testid="panel-title">{title}</h2>
      {children}
    </div>
  );
  SettingsPanel.displayName = "SettingsPanel";
  return { default: SettingsPanel };
});

describe("PageSettings", () => {
  it("should render SettingsPanel with title and items", () => {
    renderWithProviders(<PageSettings />);

    expect(screen.getByTestId("settings-panel")).toBeInTheDocument();
    expect(screen.getByTestId("panel-title")).toHaveTextContent(/Page Settings/i);
    expect(screen.getByTestId("show-cover-as-single-page-setting")).toBeInTheDocument();
  });
});
