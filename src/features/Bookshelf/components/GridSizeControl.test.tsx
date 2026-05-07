import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/utils";
import GridSizeControl from "./GridSizeControl";

describe("GridSizeControl", () => {
  it("should render and handle change", () => {
    const onChange = vi.fn();
    renderWithProviders(<GridSizeControl value={1} onChange={onChange} />);

    expect(screen.getByRole("slider")).toBeInTheDocument();

    // Change slider value
    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: 2 } });

    expect(onChange).toHaveBeenCalledWith(2);
  });
});
