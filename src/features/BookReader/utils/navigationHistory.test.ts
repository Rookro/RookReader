import { describe, expect, it } from "vitest";
import {
  goBackHistory,
  goForwardHistory,
  type NavigationHistory,
  pushHistory,
} from "./navigationHistory";

describe("navigationHistory", () => {
  describe("pushHistory", () => {
    it("appends to an empty stack and advances the index", () => {
      const stack: NavigationHistory = { history: [], historyIndex: -1 };

      const changed = pushHistory(stack, "a");

      expect(changed).toBe(true);
      expect(stack.history).toEqual(["a"]);
      expect(stack.historyIndex).toBe(0);
    });

    it("appends a new entry to the end", () => {
      const stack: NavigationHistory = { history: ["a"], historyIndex: 0 };

      const changed = pushHistory(stack, "b");

      expect(changed).toBe(true);
      expect(stack.history).toEqual(["a", "b"]);
      expect(stack.historyIndex).toBe(1);
    });

    it("suppresses a consecutive duplicate of the current entry", () => {
      const stack: NavigationHistory = { history: ["a", "b"], historyIndex: 1 };

      const changed = pushHistory(stack, "b");

      expect(changed).toBe(false);
      expect(stack.history).toEqual(["a", "b"]);
      expect(stack.historyIndex).toBe(1);
    });

    it("allows pushing a value equal to a non-current entry", () => {
      const stack: NavigationHistory = { history: ["a", "b"], historyIndex: 1 };

      const changed = pushHistory(stack, "a");

      expect(changed).toBe(true);
      expect(stack.history).toEqual(["a", "b", "a"]);
      expect(stack.historyIndex).toBe(2);
    });

    it("truncates forward entries when the index is not at the end", () => {
      const stack: NavigationHistory = { history: ["a", "b", "c"], historyIndex: 0 };

      const changed = pushHistory(stack, "d");

      expect(changed).toBe(true);
      expect(stack.history).toEqual(["a", "d"]);
      expect(stack.historyIndex).toBe(1);
    });
  });

  describe("goBackHistory", () => {
    it("moves back one entry and reports the change", () => {
      const stack: NavigationHistory = { history: ["a", "b"], historyIndex: 1 };

      const changed = goBackHistory(stack);

      expect(changed).toBe(true);
      expect(stack.historyIndex).toBe(0);
    });

    it("clamps at the start of the stack", () => {
      const stack: NavigationHistory = { history: ["a", "b"], historyIndex: 0 };

      const changed = goBackHistory(stack);

      expect(changed).toBe(false);
      expect(stack.historyIndex).toBe(0);
    });
  });

  describe("goForwardHistory", () => {
    it("moves forward one entry and reports the change", () => {
      const stack: NavigationHistory = { history: ["a", "b"], historyIndex: 0 };

      const changed = goForwardHistory(stack);

      expect(changed).toBe(true);
      expect(stack.historyIndex).toBe(1);
    });

    it("clamps at the end of the stack", () => {
      const stack: NavigationHistory = { history: ["a", "b"], historyIndex: 1 };

      const changed = goForwardHistory(stack);

      expect(changed).toBe(false);
      expect(stack.historyIndex).toBe(1);
    });
  });
});
