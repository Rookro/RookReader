import {
  ListItem,
  ListItemIcon,
  ListItemText,
  Select,
  type SelectChangeEvent,
  type SelectProps,
} from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import type { ReactNode } from "react";

export interface SelectSettingItemProps<T = unknown> extends Omit<SelectProps<T>, "onChange"> {
  icon?: ReactNode;
  primaryText: string;
  secondaryText?: string;
  secondaryTextSx?: SxProps<Theme>;
  onChange: (event: SelectChangeEvent<T>, child: React.ReactNode) => void;
  children: ReactNode;
  sx?: SxProps<Theme>;
}

export default function SelectSettingItem<T>({
  icon,
  primaryText,
  secondaryText,
  secondaryTextSx,
  onChange,
  children,
  sx,
  ...selectProps
}: SelectSettingItemProps<T>) {
  return (
    <ListItem sx={sx}>
      {icon && <ListItemIcon>{icon}</ListItemIcon>}
      <ListItemText
        primary={primaryText}
        secondary={secondaryText}
        slotProps={{ secondary: { sx: secondaryTextSx } }}
      />
      <Select variant="standard" onChange={onChange} size="small" autoWidth {...selectProps}>
        {children}
      </Select>
    </ListItem>
  );
}
