import MenuBookOutlined from "@mui/icons-material/MenuBookOutlined";
import { Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

/**
 * Tells how to open a book, laid over the reading area while no book is open.
 *
 * It lets pointer events through, so the reader underneath behaves as it does without it.
 */
export default function ReaderEmptyState() {
  const { t } = useTranslation();
  return (
    <Stack
      sx={{
        position: "absolute",
        inset: 0,
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
        padding: 2,
        textAlign: "center",
        color: "text.secondary",
        pointerEvents: "none",
      }}
    >
      <MenuBookOutlined sx={{ fontSize: 48 }} />
      <Typography>{t("book-reader.empty-state.how-to-open")}</Typography>
      <Typography variant="body2">{t("book-reader.empty-state.formats")}</Typography>
    </Stack>
  );
}
