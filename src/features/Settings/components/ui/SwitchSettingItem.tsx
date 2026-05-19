import { ListItem, ListItemIcon, ListItemText, Switch, type SwitchProps } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import type { ReactNode } from "react";

export interface SwitchSettingItemProps
  extends Omit<SwitchProps, "onChange" | "checked" | "defaultChecked"> {
  icon?: ReactNode;
  primaryText: string;
  secondaryText?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => void;
  secondaryActionSx?: SxProps<Theme>;
  sx?: SxProps<Theme>;
}

export default function SwitchSettingItem({
  icon,
  primaryText,
  secondaryText,
  checked,
  defaultChecked,
  onChange,
  secondaryActionSx,
  sx,
  ...switchProps
}: SwitchSettingItemProps) {
  return (
    <ListItem
      sx={sx}
      secondaryAction={
        <Switch
          edge="end"
          checked={checked}
          defaultChecked={defaultChecked}
          onChange={onChange}
          sx={secondaryActionSx}
          {...switchProps}
        />
      }
    >
      {icon && <ListItemIcon>{icon}</ListItemIcon>}
      <ListItemText primary={primaryText} secondary={secondaryText} sx={{ marginRight: 3 }} />
    </ListItem>
  );
}
