import { Stack } from "@mui/material";
import About from "./Items/About";
import ThirdParty from "./Items/ThirdParty";

/**
 * About page component.
 */
export default function AboutPage() {
    return (
        <Stack spacing={3}>
            <About />
            <ThirdParty />
        </Stack>
    );
}
