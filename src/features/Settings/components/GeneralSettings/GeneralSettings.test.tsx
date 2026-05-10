import { screen } from "@testing-library/react";
import type { JSX } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/utils";
import GeneralSettings from "./GeneralSettings";

// Mock sub-components
vi.mock("./Items/LanguageSettings", () => {
  const LanguageSettings = (): JSX.Element => <div data-testid="language-setting" />;
  LanguageSettings.displayName = "LanguageSettings";
  return { default: LanguageSettings };
});

vi.mock("./Items/AppFontFamilySetting", () => {
  const AppFontFamilySetting = (): JSX.Element => <div data-testid="app-font-family-setting" />;
  AppFontFamilySetting.displayName = "AppFontFamilySetting";
  return { default: AppFontFamilySetting };
});

vi.mock("./Items/ThemeSetting", () => {
  const ThemeSetting = (): JSX.Element => <div data-testid="theme-setting" />;
  ThemeSetting.displayName = "ThemeSetting";
  return { default: ThemeSetting };
});

vi.mock("./Items/InitialViewSetting", () => {
  const InitialViewSetting = (): JSX.Element => <div data-testid="initial-view-setting" />;
  InitialViewSetting.displayName = "InitialViewSetting";
  return { default: InitialViewSetting };
});

vi.mock("./Items/RestoreLastBookSetting", () => {
  const RestoreLastBookSetting = (): JSX.Element => <div data-testid="restore-last-book-setting" />;
  RestoreLastBookSetting.displayName = "RestoreLastBookSetting";
  return { default: RestoreLastBookSetting };
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

describe("GeneralSettings", () => {
  it("should render SettingsPanel with title and all general setting items", () => {
    renderWithProviders(<GeneralSettings />);

    expect(screen.getByTestId("settings-panel")).toBeInTheDocument();
    // Use regex to be flexible with translation key or resolved text
    expect(screen.getByTestId("panel-title")).toHaveTextContent(/General Settings/i);

    expect(screen.getByTestId("language-setting")).toBeInTheDocument();
    expect(screen.getByTestId("app-font-family-setting")).toBeInTheDocument();
    expect(screen.getByTestId("theme-setting")).toBeInTheDocument();
    expect(screen.getByTestId("initial-view-setting")).toBeInTheDocument();
    expect(screen.getByTestId("restore-last-book-setting")).toBeInTheDocument();
    expect(screen.getByTestId("check-update-on-startup-setting")).toBeInTheDocument();
  });
});
