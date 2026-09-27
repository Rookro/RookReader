import { Menu, type MenuProps } from "@mui/material";
import type { ContextMenuAnchor } from "./useContextMenuAnchor";

/** Props for the ContextMenu component. */
export interface ContextMenuProps
  extends Omit<MenuProps, "open" | "anchorReference" | "anchorPosition" | "onClose"> {
  /** Where the menu was opened; null keeps it closed. */
  anchor: ContextMenuAnchor | null;
  /** Called when the menu should close. */
  onClose: () => void;
}

/** A MUI Menu positioned at the pointer; right-clicking the open menu closes it. */
export default function ContextMenu({ anchor, onClose, children, ...menuProps }: ContextMenuProps) {
  return (
    <Menu
      open={anchor !== null}
      onClose={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
      anchorReference="anchorPosition"
      anchorPosition={anchor !== null ? { top: anchor.mouseY, left: anchor.mouseX } : undefined}
      slotProps={{ list: { dense: true } }}
      {...menuProps}
    >
      {children}
    </Menu>
  );
}
