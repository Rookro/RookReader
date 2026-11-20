import { Menu, type MenuProps, menuItemClasses } from "@mui/material";
import { useState } from "react";
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
 * from the keyboard does not restore focus when it closes. While the keyboard is in use, the
 * focused item is highlighted.
 */
export default function ContextMenu({
  anchor,
  onClose,
  onKeyDown,
  sx,
  children,
  ...menuProps
}: ContextMenuProps) {
  // The opening whose menu has seen a keydown; a new anchor starts over.
  const [keyboardAnchor, setKeyboardAnchor] = useState<ContextMenuAnchor | null>(null);
  const keyboardInUse =
    anchor !== null && (anchor.fromKeyboard === true || keyboardAnchor === anchor);

  return (
    <Menu
      open={anchor !== null}
      onClose={(_event, reason) => onClose(reason)}
      onKeyDown={(e) => {
        setKeyboardAnchor(anchor);
        onKeyDown?.(e);
      }}
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
      // WebKitGTK never matches :focus-visible after a mouse click, so MUI's Mui-focusVisible
      // highlight is drawn here from :focus instead.
      sx={[
        keyboardInUse && {
          [`& .${menuItemClasses.root}:focus`]: { backgroundColor: "action.focus" },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...menuProps}
    >
      {children}
    </Menu>
  );
}
