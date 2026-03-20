import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../test/utils";
import RenderingSettings from "./RenderingSettings";
import { JSX } from "react";

// Mock sub-components
vi.mock("./Items/PreviewSetting", () => {
  const PreviewSetting = (): JSX.Element => <div data-testid="preview-setting" />;
  PreviewSetting.displayName = "PreviewSetting";
  return { default: PreviewSetting };
});

vi.mock("./Items/MaxImageHeightSetting", () => {
  const MaxImageHeightSetting = (): JSX.Element => <div data-testid="max-image-height-setting" />;
  MaxImageHeightSetting.displayName = "MaxImageHeightSetting";
  return { default: MaxImageHeightSetting };
});

vi.mock("./Items/ImageResizeMethodSetting", () => {
  const ImageResizeMethodSetting = (): JSX.Element => (
    <div data-testid="image-resize-method-setting" />
  );
  ImageResizeMethodSetting.displayName = "ImageResizeMethodSetting";
  return { default: ImageResizeMethodSetting };
});

vi.mock("./Items/PdfRenderingSetting", () => {
  const PdfRenderingSetting = (): JSX.Element => <div data-testid="pdf-rendering-setting" />;
  PdfRenderingSetting.displayName = "PdfRenderingSetting";
  return { default: PdfRenderingSetting };
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

describe("RenderingSettings", () => {
  it("should render SettingsPanel with title and all items", () => {
    renderWithProviders(<RenderingSettings />);

    expect(screen.getByTestId("settings-panel")).toBeInTheDocument();
    expect(screen.getByTestId("panel-title")).toHaveTextContent(/Rendering Settings/i);
    expect(screen.getByTestId("preview-setting")).toBeInTheDocument();
    expect(screen.getByTestId("max-image-height-setting")).toBeInTheDocument();
    expect(screen.getByTestId("image-resize-method-setting")).toBeInTheDocument();
    expect(screen.getByTestId("pdf-rendering-setting")).toBeInTheDocument();
  });
});
