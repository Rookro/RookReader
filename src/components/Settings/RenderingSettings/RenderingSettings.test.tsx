import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../test/utils";
import RenderingSettings from "./RenderingSettings";
import { JSX } from "react";

// Mock sub-components
vi.mock("./Items/ThumbnailPreviewSetting", () => {
  const ThumbnailPreviewSetting = (): JSX.Element => (
    <div data-testid="thumbnail-preview-setting" />
  );
  ThumbnailPreviewSetting.displayName = "ThumbnailPreviewSetting";
  return { default: ThumbnailPreviewSetting };
});

vi.mock("./Items/MaxImageHeightSetting", () => {
  const MaxImageHeightSetting = (): JSX.Element => <div data-testid="max-image-height-setting" />;
  MaxImageHeightSetting.displayName = "MaxImageHeightSetting";
  return { default: MaxImageHeightSetting };
});

vi.mock("./Items/ImageResamplingMethodSetting", () => {
  const ImageResamplingMethodSetting = (): JSX.Element => (
    <div data-testid="image-resampling-method-setting" />
  );
  ImageResamplingMethodSetting.displayName = "ImageResamplingMethodSetting";
  return { default: ImageResamplingMethodSetting };
});

vi.mock("./Items/PdfRenderResolutionHeightSetting", () => {
  const PdfRenderResolutionHeightSetting = (): JSX.Element => (
    <div data-testid="pdf-render-resolution-height-setting" />
  );
  PdfRenderResolutionHeightSetting.displayName = "PdfRenderResolutionHeightSetting";
  return { default: PdfRenderResolutionHeightSetting };
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
    expect(screen.getByTestId("thumbnail-preview-setting")).toBeInTheDocument();
    expect(screen.getByTestId("max-image-height-setting")).toBeInTheDocument();
    expect(screen.getByTestId("image-resampling-method-setting")).toBeInTheDocument();
    expect(screen.getByTestId("pdf-render-resolution-height-setting")).toBeInTheDocument();
  });
});
