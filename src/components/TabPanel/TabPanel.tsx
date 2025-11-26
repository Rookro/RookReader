import { Box, SxProps } from "@mui/material";

/**
 * タブパネルコンポーネントのプロパティ
 */
interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
    sx?: SxProps;
}

/**
 * タブパネルコンポーネント
 */
export default function TabPanel(props: TabPanelProps) {
    const { children, value, index, sx, ...other } = props;

    return value === index && (
        <Box
            hidden={value !== index}
            sx={sx}
            {...other}
        >
            {children}
        </Box>
    );
};
