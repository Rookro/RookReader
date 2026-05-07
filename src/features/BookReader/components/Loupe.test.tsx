import { render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import Loupe from "./Loupe";

describe("Loupe", () => {
  const mockContainerRef = {
    current: document.createElement("div"),
  };

  beforeAll(() => {
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it("should render children only once when loupe is disabled", () => {
    render(
      <Loupe isLoupeEnabled={false} loupePos={{ x: 10, y: 10 }} containerRef={mockContainerRef}>
        <div data-testid="child-element">Child Content</div>
      </Loupe>,
    );

    expect(screen.getAllByTestId("child-element")).toHaveLength(1);
  });

  it("should apply correct styles for zoom and radius", () => {
    const zoom = 4;
    const radius = 120;
    const loupePos = { x: 100, y: 150 };

    const { container } = render(
      <Loupe
        isLoupeEnabled={true}
        loupePos={loupePos}
        containerRef={mockContainerRef}
        zoom={zoom}
        radius={radius}
      >
        <div data-testid="child-element">Child Content</div>
      </Loupe>,
    );

    // The outer box should hide the cursor
    const outerBox = container.firstChild as HTMLElement;
    expect(outerBox).toHaveStyle({
      cursor: "none",
    });

    // The lens is the circular box
    const lens = container.querySelector(".MuiBox-root > .MuiBox-root + .MuiBox-root");
    expect(lens).toHaveStyle({
      width: `${radius * 2}px`,
      height: `${radius * 2}px`,
      left: `${loupePos.x - radius}px`,
      top: `${loupePos.y - radius}px`,
    });

    // The inner content should be scaled and shifted
    const innerContentContainer = lens?.firstChild as HTMLElement;
    expect(innerContentContainer).toHaveStyle({
      transform: `scale(${zoom})`,
      transformOrigin: `${loupePos.x}px ${loupePos.y}px`,
      left: `${-(loupePos.x - radius)}px`,
      top: `${-(loupePos.y - radius)}px`,
    });
  });
});
