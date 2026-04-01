import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../test/utils";
import NovelReaderSettings from "./NovelReaderSettings";
import { JSX } from "react";

// Mock sub-components
vi.mock("./Items/FontSettings", () => {
  const FontSettings = (): JSX.Element => <div data-testid="font-settings" />;
  FontSettings.displayName = "FontSettings";
  return { default: FontSettings };
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

describe("NovelReaderSettings", () => {
  it("should render SettingsPanel with title and font settings", () => {
    renderWithProviders(<NovelReaderSettings />);

    expect(screen.getByTestId("settings-panel")).toBeInTheDocument();
    expect(screen.getByTestId("panel-title")).toHaveTextContent(/Novel Reader Settings/i);
    expect(screen.getByTestId("font-settings")).toBeInTheDocument();
  });
});
