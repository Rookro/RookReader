import { Tooltip } from "@mui/material";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useRowTooltip } from "./useRowTooltip";

/** A row whose tooltip uses the hook, exposing `followCursor` as a data attribute. */
function Row({ keyboardActive }: { keyboardActive: boolean }) {
  const tooltip = useRowTooltip(keyboardActive);
  return (
    <Tooltip title="Row title" placement="right-start" {...tooltip}>
      <div data-follow-cursor={String(tooltip.followCursor)}>Row</div>
    </Tooltip>
  );
}

describe("useRowTooltip", () => {
  const user = userEvent.setup();

  it("shows the tooltip at the row while keyboard-active, without a pointer", () => {
    render(<Row keyboardActive={true} />);

    expect(screen.getByRole("tooltip")).toHaveTextContent("Row title");
    expect(screen.getByText("Row")).toHaveAttribute("data-follow-cursor", "false");
  });

  it("shows the tooltip on hover after the delay and follows the cursor", async () => {
    render(<Row keyboardActive={false} />);

    await user.hover(screen.getByText("Row"));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Row title");
    expect(screen.getByText("Row")).toHaveAttribute("data-follow-cursor", "true");
  });

  it("hides the keyboard tooltip when the row stops being keyboard-active", async () => {
    const { rerender } = render(<Row keyboardActive={true} />);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    rerender(<Row keyboardActive={false} />);

    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
  });
});
