import { Divider, IconButton, Stack, Typography } from "@mui/material";
import { Close } from "@mui/icons-material";
import { useCallback } from "react";
import { useAppDispatch } from "../../Store";
import { setIsLeftSidePanelsHidden } from "../../reducers/SidePaneReducer";

export default function SidePanelHeader(props: { title: string }) {
  const dispatch = useAppDispatch();
  const handleCloseClicked = useCallback(
    (_e: React.MouseEvent<HTMLButtonElement>) => {
      dispatch(setIsLeftSidePanelsHidden(true));
    },
    [dispatch],
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
        <IconButton size="small" sx={{ padding: 0 }} onClick={handleCloseClicked}>
          <Close fontSize="small" />
        </IconButton>
      </Stack>
      <Divider />
    </>
  );
}
