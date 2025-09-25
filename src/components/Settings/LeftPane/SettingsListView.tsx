import { useState } from "react";
import { Box, List, ListItemButton, ListItemText } from "@mui/material";
import { Search } from "@mui/icons-material";
import "./SettingsListView.css";

type Setting = {
    name: string
}

const settings: Setting[] = [
    { name: "General" },
]

function SettingsListView() {
    const [searchText, setSearchText] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);

    const handleListItemFocused = (
        _e: React.FocusEvent,
        index: number,
    ) => {
        setSelectedIndex(index);
    };

    const handleListItemClicked = async (
        _e: React.MouseEvent<HTMLDivElement>,
        _setting: Setting,
    ) => {
    };

    const handleSearchTextChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchText(e.target.value);
    }

    return (
        <div className="settings-list-view">
            <Box sx={{ minWidth: "270px", display: 'grid', alignContent: 'start' }}>
                <Box className="settings-search-bar">
                    <Search />
                    <input type='search' value={searchText} onChange={handleSearchTextChanged}></input>
                </Box>
                <List className="settings-list" component="nav" dense={true}>
                    {settings
                        .filter((setting) => searchText ? setting.name.toLowerCase().includes(searchText.toLowerCase()) : true)
                        .map((setting, index) =>
                            <ListItemButton className="setting-item"
                                selected={selectedIndex === index}
                                onFocus={(e) => handleListItemFocused(e, index)}
                                onClick={(e) => handleListItemClicked(e, setting)}
                                key={index}
                            >
                                <ListItemText primary={setting.name} />
                            </ListItemButton>)
                    }
                </List>
            </Box>
        </div >
    );
}

export default SettingsListView;
