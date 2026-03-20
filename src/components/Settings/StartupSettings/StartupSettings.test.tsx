import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../test/utils";
import StartupSettings from "./StartupSettings";
import { JSX } from "react";

// Mock sub-components
vi.mock("./Items/InitialViewSetting", () => {
  const InitialViewSetting = (): JSX.Element => <div data-testid="initial-view-setting" />;
  InitialViewSetting.displayName = "InitialViewSetting";
  return { default: InitialViewSetting };
});

vi.mock("./Items/RestoreOnStartupSetting", () => {
  const RestoreOnStartupSetting = (): JSX.Element => (
    <div data-testid="restore-on-startup-setting" />
  );
  RestoreOnStartupSetting.displayName = "RestoreOnStartupSetting";
  return { default: RestoreOnStartupSetting };
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

describe("StartupSettings", () => {
  it("should render SettingsPanel with title and items", () => {
    renderWithProviders(<StartupSettings />);

    expect(screen.getByTestId("settings-panel")).toBeInTheDocument();
    expect(screen.getByTestId("panel-title")).toHaveTextContent(/Startup Settings/i);
    expect(screen.getByTestId("initial-view-setting")).toBeInTheDocument();
    expect(screen.getByTestId("restore-on-startup-setting")).toBeInTheDocument();
  });
});
