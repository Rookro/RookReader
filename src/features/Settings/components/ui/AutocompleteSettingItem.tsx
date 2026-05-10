import { Autocomplete, ListItem, ListItemIcon, ListItemText, TextField } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import type { ReactNode } from "react";

export interface AutocompleteOption {
  label: string;
  value: string;
}

export interface AutocompleteSettingItemProps {
  icon?: ReactNode;
  primaryText: string;
  secondaryText?: string;
  secondaryTextSx?: SxProps<Theme>;
  options: AutocompleteOption[];
  value: string;
  onChange: (value: string) => void;
  renderOption?: (
    props: React.HTMLAttributes<HTMLLIElement>,
    option: AutocompleteOption,
  ) => React.ReactNode;
  noOptionsText?: ReactNode;
  sx?: SxProps<Theme>;
}

export default function AutocompleteSettingItem({
  icon,
  primaryText,
  secondaryText,
  secondaryTextSx,
  options,
  value,
  onChange,
  renderOption,
  noOptionsText,
  sx,
}: AutocompleteSettingItemProps) {
  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <ListItem sx={sx}>
      {icon && <ListItemIcon>{icon}</ListItemIcon>}
      <ListItemText
        primary={primaryText}
        secondary={secondaryText}
        slotProps={{ secondary: { sx: secondaryTextSx } }}
      />
      <Autocomplete
        options={options}
        getOptionLabel={(option) => option.label}
        value={selectedOption}
        onChange={(_, newValue) => {
          if (newValue) {
            onChange(newValue.value);
          }
        }}
        renderOption={renderOption}
        noOptionsText={noOptionsText}
        disableClearable
        size="small"
        sx={{ width: 250 }}
        renderInput={(params) => <TextField {...params} variant="standard" />}
      />
    </ListItem>
  );
}
