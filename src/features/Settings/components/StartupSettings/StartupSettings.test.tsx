import { screen } from "@testing-library/react";
import type { JSX } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/utils";
import StartupSettings from "./StartupSettings";

// Mock sub-components
vi.mock("./Items/InitialViewSetting", () => {
  const InitialViewSetting = (): JSX.Element => <div data-testid="initial-view-setting" />;
  InitialViewSetting.displayName = "InitialViewSetting";
  return { default: InitialViewSetting };
});

vi.mock("./Items/RestoreLastBookSetting", () => {
  const RestoreLastBooksSetting = (): JSX.Element => (
    <div data-testid="restore-last-book-setting" />
  );
  RestoreLastBooksSetting.displayName = "RestoreLastBooksSetting";
  return { default: RestoreLastBooksSetting };
});

vi.mock("./Items/CheckUpdateOnStartupSetting", () => {
  const CheckUpdateOnStartupSetting = (): JSX.Element => (
    <div data-testid="check-update-on-startup-setting" />
  );
  CheckUpdateOnStartupSetting.displayName = "CheckUpdateOnStartupSetting";
  return { default: CheckUpdateOnStartupSetting };
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
    expect(screen.getByTestId("restore-last-book-setting")).toBeInTheDocument();
    expect(screen.getByTestId("check-update-on-startup-setting")).toBeInTheDocument();
  });
});
