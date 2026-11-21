import { useCallback, useState } from "react";

/** Props for a MUI `Tooltip` on a list row, from {@link useRowTooltip}. */
export interface RowTooltipProps {
  /** Whether the tooltip is shown. */
  open: boolean;
  /** Whether the tooltip follows the cursor; off for the keyboard, which has no pointer position. */
  followCursor: boolean;
  /** Marks the row as hovered; MUI calls it after its enter delay. */
  onOpen: () => void;
  /** Marks the row as no longer hovered; MUI calls it after its leave delay. */
  onClose: () => void;
}

/**
 * Controls a list row's tooltip, so the keyboard's active row shows it beside the row while a
 * hovered row shows it at the cursor, as an uncontrolled tooltip does.
 *
 * @param keyboardActive - Whether the row is the keyboard's active row in a focused list.
 * @returns Props to spread onto the row's MUI `Tooltip`.
 */
export function useRowTooltip(keyboardActive: boolean): RowTooltipProps {
  const [hovered, setHovered] = useState(false);
  const onOpen = useCallback(() => setHovered(true), []);
  const onClose = useCallback(() => setHovered(false), []);
  return {
    open: hovered || keyboardActive,
    followCursor: !(keyboardActive && !hovered),
    onOpen,
    onClose,
  };
}
