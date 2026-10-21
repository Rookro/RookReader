import { Link } from "@mui/material";
import { error } from "@tauri-apps/plugin-log";
import { openUrl } from "@tauri-apps/plugin-opener";
import type React from "react";

const OPENABLE_PROTOCOLS = ["http:", "https:", "mailto:"];

function isOpenable(href: string | undefined): href is string {
  if (!href) {
    return false;
  }
  try {
    return OPENABLE_PROTOCOLS.includes(new URL(href).protocol);
  } catch {
    return false;
  }
}

/**
 * A Markdown link that opens in the default browser or mail app.
 *
 * A plain `<a>` would navigate the app window itself, with no way back. Links with any
 * other scheme, or relative ones, render as plain text.
 *
 * @param props - The anchor attributes from the Markdown renderer; only `href` and
 *   `children` are used.
 */
export default function ExternalLink({
  href,
  children,
}: React.AnchorHTMLAttributes<HTMLAnchorElement>): React.ReactElement {
  if (!isOpenable(href)) {
    return <>{children}</>;
  }

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    openUrl(href).catch((e) => {
      error(`Failed to open the link ${href}: ${e}`);
    });
  };

  return (
    <Link href={href} onClick={handleClick}>
      {children}
    </Link>
  );
}
