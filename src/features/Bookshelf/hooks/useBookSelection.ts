import { useContext } from "react";
import { BookSelectionContext } from "../components/BookSelectionContext";

/** Hook to use the book selection context */
export const useBookSelection = () => {
  const context = useContext(BookSelectionContext);
  if (!context) {
    throw new Error("useBookSelection must be used within a BookSelectionProvider");
  }
  return context;
};
