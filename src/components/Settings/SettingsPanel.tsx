import { Container, Paper, SxProps, Typography } from "@mui/material";

/**
 * Properties for the TabPanel component.
 */
interface SettingsPanelProps {
  title: string;
  children?: React.ReactNode;
  sx?: SxProps;
}

/**
 * Tab panel component.
 */
export default function SettingsPanel(props: SettingsPanelProps) {
  const { title, children, sx, ...other } = props;

  return (
    <Container sx={sx} {...other}>
      <Typography variant="h6" gutterBottom sx={{ fontWeight: "bold" }}>
        {title}
      </Typography>
      <Paper elevation={3} sx={{ padding: 2 }}>
        {children}
      </Paper>
    </Container>
  );
}
