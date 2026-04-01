import { describe, it, expect } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, testI18n as i18n } from "../../../../../test/utils";
import LanguageSettings from "./LanguageSettings";

describe("LanguageSettings", () => {
  const user = userEvent.setup();

  it("should change language when a selection is made", async () => {
    renderWithProviders(<LanguageSettings />);

    // Open the select
    const select = screen.getByRole("combobox");
    await user.click(select);

    // The listbox is rendered in a portal
    const listbox = await screen.findByRole("listbox");

    // Select Japanese
    const japaneseOption = within(listbox).getByText(/日本語/i);
    await user.click(japaneseOption);

    expect(i18n.language).toBe("ja-JP");

    // Switch back to English
    await user.click(screen.getByRole("combobox"));
    const listbox2 = await screen.findByRole("listbox");
    const englishOption = within(listbox2).getByText(/English/i);
    await user.click(englishOption);

    expect(i18n.language).toBe("en-US");
  });
});
