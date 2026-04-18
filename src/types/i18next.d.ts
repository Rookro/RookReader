import "i18next";
import type namespace from "../i18n/locales/en-US.json";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: {
      translation: typeof namespace;
    };
  }
}
