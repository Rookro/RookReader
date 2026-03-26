import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../test/utils";
import HistorySettings from "./HistorySettings";
import { JSX } from "react";

// Mock sub-components
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

describe("HistorySettings", () => {
  it("should render SettingsPanel with title and items", () => {
    renderWithProviders(<HistorySettings />);

    expect(screen.getByTestId("settings-panel")).toBeInTheDocument();
    expect(screen.getByTestId("panel-title")).toHaveTextContent(/History Settings/i);
    expect(screen.getByTestId("record-reading-history-setting")).toBeInTheDocument();
  });
});
