import type { JSX } from "react";

/** One side-pane tab: its icon button and the panel it shows. */
export interface SideTab {
  /** The accessible name and tooltip of the tab. */
  label: string;
  /** The icon shown in the tab strip. */
  icon: JSX.Element;
  /** The panel shown while the tab is selected. */
  panel: JSX.Element;
}
