import { screen } from "@testing-library/react";
import type { JSX } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/utils";
import ReaderSettings from "./ReaderSettings";

// Mock sub-components
vi.mock("./Items/ShowCoverAsSinglePageSetting", () => {
  const ShowCoverAsSinglePageSetting = (): JSX.Element => (
    <div data-testid="show-cover-as-single-page-setting" />
  );
  ShowCoverAsSinglePageSetting.displayName = "ShowCoverAsSinglePageSetting";
  return { default: ShowCoverAsSinglePageSetting };
});

vi.mock("./Items/LoupeSettingsItem", () => {
  const LoupeSettingsItem = (): JSX.Element => <div data-testid="loupe-settings-item" />;
  LoupeSettingsItem.displayName = "LoupeSettingsItem";
  return { default: LoupeSettingsItem };
});

vi.mock("./Items/FontSettings", () => {
  const FontSettings = (): JSX.Element => <div data-testid="font-settings" />;
  FontSettings.displayName = "FontSettings";
  return { default: FontSettings };
});

vi.mock("./Items/RecordReadingHistorySetting", () => {
  const RecordReadingHistorySetting = (): JSX.Element => (
    <div data-testid="record-reading-history-setting" />
  );
  RecordReadingHistorySetting.displayName = "RecordReadingHistorySetting";
  return { default: RecordReadingHistorySetting };
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

describe("ReaderSettings", () => {
  it("should render SettingsPanel with title and all reader setting items", () => {
    renderWithProviders(<ReaderSettings />);

    expect(screen.getByTestId("settings-panel")).toBeInTheDocument();
    expect(screen.getByTestId("panel-title")).toHaveTextContent(/Reader Settings/i);

    expect(screen.getByTestId("show-cover-as-single-page-setting")).toBeInTheDocument();
    expect(screen.getByTestId("loupe-settings-item")).toBeInTheDocument();
    expect(screen.getByTestId("font-settings")).toBeInTheDocument();
    expect(screen.getByTestId("record-reading-history-setting")).toBeInTheDocument();
  });
});
