import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import translationEnUs from "./locales/en-US.json";
import translationJaJp from "./locales/ja-JP.json";
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: {
      en: ["en-US"],
      ja: ["ja-JP"],
      default: ["en-US"],
    },
    resources: {
      "en-US": {
        translation: translationEnUs,
      },
      "ja-JP": {
        translation: translationJaJp,
      },
    },
    interpolation: {
      escapeValue: false, // React already safes from xss
    },
  });

export default i18n;
