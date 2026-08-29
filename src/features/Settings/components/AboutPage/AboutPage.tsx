import { useTranslation } from "react-i18next";
import SettingsPanel from "../SettingsPanel";
import About from "./Items/About";
import ThirdParty from "./Items/ThirdParty";

/**
 * About page component.
 */
export default function AboutPage() {
  const { t } = useTranslation();

  return (
    <SettingsPanel title={t("settings.about.title")} sx={{ minWidth: "650px" }}>
      <About />
      <ThirdParty />
    </SettingsPanel>
  );
}
