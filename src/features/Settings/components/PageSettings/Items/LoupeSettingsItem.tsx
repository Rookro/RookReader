import { Search } from "@mui/icons-material";
import { Box, ListItem, ListItemIcon, ListItemText, TextField } from "@mui/material";
import { emit } from "@tauri-apps/api/event";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import NumberSpinner from "../../../../../components/ui/NumberSpinner";
import { useAppDispatch, useAppSelector } from "../../../../../store/store";
import type { SettingsChangedEvent } from "../../../../../types/SettingsChangedEvent";
import { updateSettings } from "../../../slice";

/**
 * Loupe setting component.
 */
export default function LoupeSettingsItem() {
  const { t } = useTranslation();
  const readerSettings = useAppSelector((state) => state.settings.reader);
  const dispatch = useAppDispatch();
  const toggleKey = readerSettings.comic.loupe?.toggleKey || "MouseMiddle";
  const [isFocused, setIsFocused] = useState(false);

  const handleUpdate = useCallback(
    async (newLoupeSettings: Partial<typeof readerSettings.comic.loupe>) => {
      const newSettings = {
        ...readerSettings,
        comic: {
          ...readerSettings.comic,
          loupe: {
            ...readerSettings.comic.loupe,
            ...newLoupeSettings,
          },
        },
      };
      await dispatch(updateSettings({ key: "reader", value: newSettings }));

      await emit<SettingsChangedEvent>("settings-changed", {
        appSettings: { reader: newSettings },
      });
    },
    [dispatch, readerSettings],
  );

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        if (e.target instanceof HTMLInputElement) {
          e.target.blur();
        }
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (e.key === "Tab") {
        return; // Allow default tab behavior
      }

      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Backspace" || e.key === "Delete") {
        return;
      }

      const modifiers = [];
      if (e.ctrlKey) {
        modifiers.push("Ctrl");
      }
      if (e.altKey) {
        modifiers.push("Alt");
      }
      if (e.shiftKey) {
        modifiers.push("Shift");
      }
      if (e.metaKey) {
        modifiers.push("Meta");
      }

      const isModifierOnly = ["Control", "Alt", "Shift", "Meta"].includes(e.key);
      let keyName = e.key;

      if (!isModifierOnly) {
        if (keyName === " ") {
          keyName = "Space";
        } else if (keyName.length === 1) {
          keyName = keyName.toUpperCase();
        } else {
          keyName = keyName.charAt(0).toUpperCase() + keyName.slice(1);
        }
      }

      const keyCombo = [...modifiers, isModifierOnly ? "" : keyName].filter(Boolean).join("+");

      if (keyCombo && !isModifierOnly) {
        handleUpdate({ toggleKey: keyCombo });
      }
    },
    [handleUpdate],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLInputElement>) => {
      if (!isFocused) return;

      if (e.button === 1 || e.button === 3 || e.button === 4) {
        e.preventDefault();
        e.stopPropagation();

        const modifiers = [];
        if (e.ctrlKey) {
          modifiers.push("Ctrl");
        }
        if (e.altKey) {
          modifiers.push("Alt");
        }
        if (e.shiftKey) {
          modifiers.push("Shift");
        }
        if (e.metaKey) {
          modifiers.push("Meta");
        }

        let buttonName = "";
        if (e.button === 1) {
          buttonName = "MouseMiddle";
        } else if (e.button === 3) {
          buttonName = "MouseBack";
        } else if (e.button === 4) {
          buttonName = "MouseForward";
        }

        const keyCombo = [...modifiers, buttonName].filter(Boolean).join("+");
        if (keyCombo) {
          handleUpdate({ toggleKey: keyCombo });
        }
      }
    },
    [handleUpdate, isFocused],
  );

  const handleZoomChange = useCallback(
    (value: number | null) => {
      const val = value ?? 2;
      if (!Number.isNaN(val) && val > 0) {
        handleUpdate({ zoom: val });
      }
    },
    [handleUpdate],
  );

  const handleRadiusChange = useCallback(
    (value: number | null) => {
      const val = value ?? 150;
      if (!Number.isNaN(val) && val > 0) {
        handleUpdate({ radius: val });
      }
    },
    [handleUpdate],
  );

  const formatKeyCombo = useCallback(
    (keyCombo: string) => {
      if (!keyCombo) return "";
      return keyCombo
        .split("+")
        .map((part) => {
          if (part === "MouseMiddle") {
            return t("settings.page.loupe.mouse-middle");
          }
          if (part === "MouseBack") {
            return t("settings.page.loupe.mouse-back");
          }
          if (part === "MouseForward") {
            return t("settings.page.loupe.mouse-forward");
          }
          return part;
        })
        .join("+");
    },
    [t],
  );

  return (
    <>
      <ListItem>
        <ListItemIcon>
          <Search />
        </ListItemIcon>
        <ListItemText
          primary={t("settings.page.loupe.title")}
          secondary={t("settings.page.loupe.description")}
          slotProps={{ secondary: { sx: { whiteSpace: "pre-wrap" } } }}
        />
      </ListItem>

      <ListItem sx={{ paddingLeft: 9 }}>
        <ListItemText
          primary={t("settings.page.loupe.toggle-key")}
          secondary={t("settings.page.loupe.toggle-key-description")}
          sx={{ marginRight: "10px" }}
          slotProps={{ secondary: { sx: { whiteSpace: "pre-wrap" } } }}
        />
        <Box component="form" sx={{ display: "flex", justifyContent: "flex-end" }}>
          <TextField
            variant="standard"
            key={toggleKey}
            name="toggleKey"
            value={formatKeyCombo(toggleKey)}
            onChange={() => {}} // dummy to avoid React warning
            onKeyDown={handleKeyDown}
            onMouseDown={handleMouseDown}
            onContextMenu={handleContextMenu}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            size="small"
            slotProps={{ input: { readOnly: true } }}
            sx={{
              "& .MuiInputBase-input": {
                cursor: "pointer",
                textAlign: "center",
              },
            }}
          />
        </Box>
      </ListItem>

      <ListItem sx={{ paddingLeft: 9 }}>
        <ListItemText
          primary={t("settings.page.loupe.zoom")}
          secondary={t("settings.page.loupe.zoom-description")}
          sx={{ marginRight: "10px" }}
          slotProps={{ secondary: { sx: { whiteSpace: "pre-wrap" } } }}
        />
        <NumberSpinner
          defaultValue={readerSettings.comic.loupe?.zoom ?? 2}
          min={1}
          step={0.1}
          size="small"
          onValueCommitted={handleZoomChange}
          sx={{ minWidth: "200px" }}
        />
      </ListItem>

      <ListItem sx={{ paddingLeft: 9 }}>
        <ListItemText
          primary={t("settings.page.loupe.radius")}
          secondary={t("settings.page.loupe.radius-description")}
          sx={{ marginRight: "10px" }}
          slotProps={{ secondary: { sx: { whiteSpace: "pre-wrap" } } }}
        />
        <NumberSpinner
          defaultValue={readerSettings.comic.loupe?.radius ?? 150}
          min={50}
          step={10}
          size="small"
          onValueCommitted={handleRadiusChange}
          sx={{ minWidth: "200px" }}
        />
      </ListItem>
    </>
  );
}
