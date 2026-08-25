import SvgIcon, { type SvgIconProps } from "@mui/material/SvgIcon";
import type { Direction } from "../../types/AppSettings";

/** Props for the ReadingDirectionIcon component. */
export interface ReadingDirectionIconProps extends SvgIconProps {
  /** The reading direction to depict. */
  direction: Direction;
}

/**
 * Solid open book, following the silhouette of MUI's MenuBook: each page humps between
 * the spine and the outer edge, so the top reads as an M. The spine is left implied by
 * the central valley so the arrow has the interior to itself.
 */
const BOOK_PATH =
  "M12 7.4C10.71 5.28 8.84 4.5 7.1 4.5 5.36 4.5 3.49 5.28 2.2 7.4V19.65C4.07 19.19 5.81 18.2 7.1 18.2 8.84 18.2 10.71 19.42 12 20.4 13.29 19.42 15.16 18.2 16.9 18.2 18.19 18.2 19.93 19.19 21.8 19.65V7.4C20.51 5.28 18.64 4.5 16.9 4.5 15.16 4.5 13.29 5.28 12 7.4Z";

/**
 * Arrow knocked out of the book, pointing the way the pages are read. Sized against the
 * interior rather than the glyph box, and proportioned like MUI's own arrows so it stays
 * legible at 24px.
 */
const ARROW_PATH: Record<Direction, string> = {
  rtl: "M18.4 10.9H10V8.1L5.4 12.3 10 16.5V13.7H18.4Z",
  ltr: "M5.6 10.9H14V8.1L18.6 12.3 14 16.5V13.7H5.6Z",
};

/**
 * Icon depicting the comic reading direction: an arrow inside an open book.
 *
 * Material provides no icon that combines pages with a direction, and a bare arrow
 * would repeat the toolbar's history arrows. The book says the glyph is about page order
 * rather than navigation, and the arrow gives the direction.
 *
 * The book and the arrow share one path so the even-odd rule knocks the arrow out as
 * negative space, the way MUI draws the digit in the neighbouring LooksOne/LooksTwo.
 *
 * @param direction - The reading direction to depict.
 * @returns The icon for the given reading direction.
 */
export default function ReadingDirectionIcon({ direction, ...props }: ReadingDirectionIconProps) {
  return (
    <SvgIcon {...props} data-testid={`ReadingDirection-${direction}`}>
      <path fillRule="evenodd" d={`${BOOK_PATH} ${ARROW_PATH[direction]}`} />
    </SvgIcon>
  );
}
