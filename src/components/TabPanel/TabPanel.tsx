import { Box, SxProps } from "@mui/material";

/**
  * Properties for the TabPanel component.
 */
interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
    sx?: SxProps;
}

/**
 * Tab panel component.
 */
export default function TabPanel(props: TabPanelProps) {
    const { children, value, index, sx, ...other } = props;

    return value === index && (
        <Box
            hidden={value !== index}
            a sx={sx}
            {...other}
        >
            {children}
        </Box>
    );
};
