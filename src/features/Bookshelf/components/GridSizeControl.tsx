import { ZoomIn, ZoomOut } from "@mui/icons-material";
import { Paper, Slider, Stack } from "@mui/material";
import { useTranslation } from "react-i18next";

interface GridSizeControlProps {
  /** Current grid size value (0, 1, or 2) */
  value: number;
  /** Callback for when the grid size changes */
  onChange: (newValue: number) => void;
}

/**
 * A component to control the grid size of the bookshelf.
 */
export default function GridSizeControl({ value, onChange }: GridSizeControlProps) {
  const { t } = useTranslation();

  return (
    <Paper
      elevation={2}
      sx={{
        position: "absolute",
        bottom: 16,
        right: 16,
        padding: 1,
        borderRadius: 3,
        width: 200,
        zIndex: 10,
      }}
    >
      <Stack direction="row" spacing={2} alignItems="center" sx={{ width: "100%" }}>
        <ZoomOut />
        <Slider
          value={value}
          onChange={(_e, newValue) => onChange(newValue as number)}
          min={0}
          max={2}
          step={1}
          marks
          valueLabelDisplay="auto"
          valueLabelFormat={(val) => {
            const labels = [
              t("bookshelf.grid-size.small"),
              t("bookshelf.grid-size.medium"),
              t("bookshelf.grid-size.large"),
            ];
            return labels[val];
          }}
        />
        <ZoomIn />
      </Stack>
    </Paper>
  );
}
