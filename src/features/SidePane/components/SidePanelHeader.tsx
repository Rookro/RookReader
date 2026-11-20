import Close from "@mui/icons-material/Close";
import { Divider, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import { type ReactNode, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "../../../store/store";
import { useApplySidePane } from "../hooks/useApplySidePane";
import { useSidePaneFocus } from "../SidePaneFocusContext";
import { isInSidePane } from "../sidePaneDom";

/** Props for {@link SidePanelHeader}. */
export interface SidePanelHeaderProps {
  /** The panel's title. */
  title: string;
  /** Buttons shown before the close button. */
  actions?: ReactNode;
}

/** Header of a side panel: its title, its own buttons, and the close button. */
export default function SidePanelHeader({ title, actions }: SidePanelHeaderProps) {
  const { t } = useTranslation();
  const applySidePane = useApplySidePane();
  const { returnToReader } = useSidePaneFocus();
  const tabIndex = useAppSelector((state) => state.settings.layout.sidePane.tabIndex);

  const handleCloseClicked = useCallback(
    (_e: React.MouseEvent<HTMLButtonElement>) => {
      applySidePane({ isHidden: true, tabIndex });
      if (isInSidePane(document.activeElement)) {
        returnToReader();
      }
    },
    [applySidePane, returnToReader, tabIndex],
  );

  return (
    <>
      <Stack
        direction="row"
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="body1" noWrap>
          {title}
        </Typography>
        <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
          {actions}
          <Tooltip title={t("common.close")}>
            <IconButton
              size="small"
              sx={{ padding: 0 }}
              onClick={handleCloseClicked}
              aria-label="close-side-panel"
            >
              <Close fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
      <Divider />
    </>
  );
}
