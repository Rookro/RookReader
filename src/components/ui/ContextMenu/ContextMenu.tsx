import { Menu, type MenuProps } from "@mui/material";
import type { ContextMenuAnchor } from "./useContextMenuAnchor";

/** Why a context menu asked to close. */
export type ContextMenuCloseReason =
  | "backdropClick"
  | "escapeKeyDown"
  | "tabKeyDown"
  | "contextMenu";

/** Props for the ContextMenu component. */
export interface ContextMenuProps
  extends Omit<MenuProps, "open" | "anchorReference" | "anchorPosition" | "onClose"> {
  /** Where the menu was opened; null keeps it closed. */
  anchor: ContextMenuAnchor | null;
  /** Called with the reason when the menu should close. */
  onClose: (reason: ContextMenuCloseReason) => void;
}

/**
 * A MUI Menu positioned at its anchor. Right-clicking the open menu closes it; a menu opened
 * from the keyboard does not restore focus when it closes.
 */
export default function ContextMenu({ anchor, onClose, children, ...menuProps }: ContextMenuProps) {
  return (
    <Menu
      open={anchor !== null}
      onClose={(_event, reason) => onClose(reason)}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        // The menu key also sends a contextmenu (button 0), which must not close the menu it opened.
        if (e.button === 2) {
          onClose("contextMenu");
        }
      }}
      anchorReference="anchorPosition"
      anchorPosition={anchor !== null ? { top: anchor.mouseY, left: anchor.mouseX } : undefined}
      slotProps={{ list: { dense: true } }}
      disableRestoreFocus={anchor?.fromKeyboard === true}
      {...menuProps}
    >
      {children}
    </Menu>
  );
}
