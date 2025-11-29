import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import translationEn from "./locales/en.json";
import translationJa from "./locales/ja.json";
i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        fallbackLng: "en",
        resources: {
            en: {
                translation: translationEn,
            },
            ja: {
                translation: translationJa,
            },
        },
        interpolation: {
            escapeValue: false, // React already safes from xss
        },
    });

export default i18n;
