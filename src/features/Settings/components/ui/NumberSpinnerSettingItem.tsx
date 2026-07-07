import { ListItem, ListItemIcon, ListItemText, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import type { ReactNode } from "react";
import NumberSpinner from "../../../../components/ui/NumberSpinner";

export interface NumberSpinnerSettingItemProps {
  icon?: ReactNode;
  primaryText: string;
  secondaryText?: string;
  secondaryTextSx?: SxProps<Theme>;
  defaultValue: number;
  min?: number;
  max?: number;
  step?: number;
  error?: boolean;
  helperText?: string;
  onValueCommitted: (value: number | null) => void;
  inputSx?: SxProps<Theme>;
  unit?: string;
  sx?: SxProps<Theme>;
}

export default function NumberSpinnerSettingItem({
  icon,
  primaryText,
  secondaryText,
  secondaryTextSx,
  defaultValue,
  min,
  max,
  step,
  error,
  helperText,
  onValueCommitted,
  inputSx,
  unit,
  sx,
}: NumberSpinnerSettingItemProps) {
  return (
    <ListItem sx={sx}>
      {icon && <ListItemIcon>{icon}</ListItemIcon>}
      <ListItemText
        primary={primaryText}
        secondary={secondaryText}
        sx={{ marginRight: "10px" }}
        slotProps={{ secondary: { sx: secondaryTextSx } }}
      />
      <NumberSpinner
        defaultValue={defaultValue}
        min={min}
        max={max}
        step={step}
        // Typed out-of-range values pass through to the backend (the validation source of
        // truth) so the inline error is shown; the step buttons/arrows still clamp to and
        // disable at min/max, which is purely a UI affordance.
        allowOutOfRange
        size="small"
        error={error}
        helperText={helperText}
        onValueCommitted={onValueCommitted}
        sx={inputSx}
      />
      {unit && (
        <Typography variant="body2" sx={{ marginLeft: 1 }}>
          {unit}
        </Typography>
      )}
    </ListItem>
  );
}
