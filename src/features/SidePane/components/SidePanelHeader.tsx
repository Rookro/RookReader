import Close from "@mui/icons-material/Close";
import { Divider, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "../../../store/store";
import { updateSettings } from "../../Settings/slice";

export default function SidePanelHeader(props: { title: string }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const tabIndex = useAppSelector((state) => state.settings.layout.sidePane.tabIndex);

  const handleCloseClicked = useCallback(
    (_e: React.MouseEvent<HTMLButtonElement>) => {
      dispatch(
        updateSettings({
          key: "layout",
          value: { sidePane: { isHidden: true, tabIndex } },
        }),
      );
    },
    [dispatch, tabIndex],
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
          {props.title}
        </Typography>
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
      <Divider />
    </>
  );
}
