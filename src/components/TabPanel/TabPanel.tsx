import { Box } from "@mui/material";

/**
 * タブパネルコンポーネントのプロパティ
 */
interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

/**
 * タブパネルコンポーネント
 */
export default function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;

    return value === index && (
        <Box
            sx={{ width: '100%', height: '100%' }}
            hidden={value !== index}
            {...other}
        >
            {children}
        </Box>
    );
};
