import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../test/utils";
import GeneralSettings from "./GeneralSettings";
import { JSX } from "react";

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
  });
});
