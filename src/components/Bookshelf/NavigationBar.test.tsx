import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NavigationBar from "./NavigationBar";
import { renderWithProviders } from "../../test/utils";
import i18n from "../../i18n/config";
import { openSettingsWindow } from "../../utils/WindowOpener";

// Mock WindowOpener
vi.mock("../../utils/WindowOpener", () => ({
  openSettingsWindow: vi.fn(),
}));

// Mock SettingsStore
vi.mock("../../settings/SettingsStore", () => ({
  settingsStore: {
    get: vi.fn(() => Promise.resolve("NAME_ASC")),
    set: vi.fn(),
  },
}));

describe("NavigationBar", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Verify that the search input field is displayed and state is updated based on input
  it("should render search input and handle text changes", async () => {
    const { store } = renderWithProviders(<NavigationBar />);

    // Search by localized placeholder text
    const searchInput = screen.getByPlaceholderText(i18n.t("bookshelf.search-placeholder"));
    expect(searchInput).toBeInTheDocument();

    await user.type(searchInput, "test query");

    expect(store.getState().bookCollection.searchText).toBe("test query");
  });

  // Verify that the sort order selection change is correctly reflected in the state
  it("should handle sort order change", async () => {
    const { store } = renderWithProviders(<NavigationBar />);

    // Initially should be NAME_ASC (from mock)
    await waitFor(() => {
      expect(store.getState().bookCollection.sortOrder).toBe("NAME_ASC");
    });

    const select = screen.getByRole("combobox");
    await user.click(select);

    // Search by localized option name
    const option = screen.getByRole("option", { name: i18n.t("bookshelf.sort.name-desc") });
    await user.click(option);

    expect(store.getState().bookCollection.sortOrder).toBe("NAME_DESC");
  });

  // Verify that the settings window is opened when the settings button is clicked
  it("should open settings window when button is clicked", async () => {
    renderWithProviders(<NavigationBar />);

    const settingsButton = screen.getByRole("button", {
      name: /settings/i,
    });
    await user.click(settingsButton);

    expect(openSettingsWindow).toHaveBeenCalled();
  });

  // Verify that the book addition dialog is displayed when the add button is clicked
  it("should open add book dialog when add button is clicked", async () => {
    renderWithProviders(<NavigationBar />);

    const addButton = screen.getByText(i18n.t("bookshelf.add-books"));
    await user.click(addButton);

    // Check if dialog title is present
    expect(screen.getByText(i18n.t("bookshelf.book-addition.title"))).toBeInTheDocument();
  });
});
