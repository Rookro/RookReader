import { Container } from "@mui/material";
import About from "./Items/About";
import ThirdParty from "./Items/ThirdParty";

/**
 * About page component.
 */
export default function AboutPage() {
    return (
        <Container sx={{ minWidth: '650px' }}>
            <About />
            <ThirdParty />
        </Container>
    );
}
