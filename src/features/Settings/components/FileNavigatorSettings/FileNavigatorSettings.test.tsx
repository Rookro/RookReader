import { screen } from "@testing-library/react";
import type { JSX } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/utils";
import FileNavigatorSettings from "./FileNavigatorSettings";

// Mock sub-components
vi.mock("./Items/HomeDirSetting", () => {
  const HomeDirSetting = (): JSX.Element => <div data-testid="home-dir-setting" />;
  HomeDirSetting.displayName = "HomeDirSetting";
  return { default: HomeDirSetting };
});

vi.mock("./Items/WatchDirectoryChangesSetting", () => {
  const WatchDirectoryChangesSetting = (): JSX.Element => (
    <div data-testid="watch-directory-changes-setting" />
  );
  WatchDirectoryChangesSetting.displayName = "WatchDirectoryChangesSetting";
  return { default: WatchDirectoryChangesSetting };
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

describe("FileNavigatorSettings", () => {
  it("should render SettingsPanel with title and items", () => {
    renderWithProviders(<FileNavigatorSettings />);

    expect(screen.getByTestId("settings-panel")).toBeInTheDocument();
    // Use regex to be flexible with translation key or resolved text
    expect(screen.getByTestId("panel-title")).toHaveTextContent(/File Navigator Settings/i);
    expect(screen.getByTestId("home-dir-setting")).toBeInTheDocument();
    expect(screen.getByTestId("watch-directory-changes-setting")).toBeInTheDocument();
  });
});
