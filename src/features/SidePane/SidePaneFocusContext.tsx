import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAppSelector } from "../../store/store";
import { useApplySidePane } from "./hooks/useApplySidePane";
import { isInOpenModal, isInSidePane } from "./sidePaneDom";

/**
 * Where a panel puts focus: its current row (resetting the active row to it), its active row,
 * its first row, or the row with the given key.
 */
export type PanelFocusRequest = "current" | "active" | "first" | { rowKey: string | number };

/** How the active panel registers with {@link SidePaneFocusProvider}. */
export interface SidePanelRegistration {
  /** Focuses the panel as requested. */
  focus: (request: PanelFocusRequest) => void;
  /** Whether the panel can take focus now (`false` while it is loading). */
  ready: boolean;
}

/** The keyboard-in-pane state and the side pane's focus commands. */
export interface SidePaneFocusApi {
  /** Whether the keyboard is working in the side pane, as of the last render. */
  isKeyboardInPane: boolean;
  /** Whether the keyboard is working in the side pane right now, between renders too. */
  isKeyboardInPaneNow: () => boolean;
  /** Shows the pane if it is hidden, then focuses the active panel on its current row. */
  enterPane: () => void;
  /** Leaves the pane: clears the state and blurs the pane's focused element. */
  returnToReader: () => void;
  /** Activates the next or previous panel (wrapping), shows the pane, and focuses the panel. */
  switchPanel: (delta: 1 | -1) => void;
  /** Focuses the active panel on its active row after its focused element was lost. */
  recoverFocus: () => void;
  /** Focuses the active panel as requested once it is registered, ready and shown. */
  requestPanelFocus: (request: PanelFocusRequest) => void;
  /** Clears the state and drops a pending focus request, leaving focus where it is. */
  releaseKeyboard: () => void;
  /** Registers the active panel; returns its unregistration. */
  registerPanel: (panel: SidePanelRegistration) => () => void;
}

const SidePaneFocusContext = createContext<SidePaneFocusApi | null>(null);

/** Props for {@link SidePaneFocusProvider}. */
export interface SidePaneFocusProviderProps {
  /** The number of panels, in the order of the side pane's tabs. */
  tabCount: number;
  /** The reader view, including the side pane's panels. */
  children: React.ReactNode;
}

/**
 * Tracks whether the keyboard is working in the side pane and focuses the active panel on
 * request. Its window listeners are attached only while the reader view is active.
 */
export function SidePaneFocusProvider({
  tabCount,
  children,
}: SidePaneFocusProviderProps): React.JSX.Element {
  const activeView = useAppSelector((state) => state.view.activeView);
  const { isHidden, tabIndex } = useAppSelector((state) => state.settings.layout.sidePane);
  const applySidePane = useApplySidePane();

  const flagRef = useRef(false);
  const [isKeyboardInPane, setFlagState] = useState(false);
  const setFlag = useCallback((value: boolean) => {
    if (flagRef.current !== value) {
      flagRef.current = value;
      setFlagState(value);
    }
  }, []);
  const panelRef = useRef<SidePanelRegistration | null>(null);
  const pendingRef = useRef<PanelFocusRequest | null>(null);
  const hiddenRef = useRef(isHidden);
  useLayoutEffect(() => {
    hiddenRef.current = isHidden;
  });

  // A request runs only once a ready panel is registered and the pane is shown: focusing inside
  // the `inert` container of a hidden pane does nothing.
  const flush = useCallback(() => {
    const panel = panelRef.current;
    const request = pendingRef.current;
    if (!panel || !request || !panel.ready || hiddenRef.current) {
      return;
    }
    pendingRef.current = null;
    panel.focus(request);
  }, []);
  useEffect(() => {
    if (!isHidden) {
      flush();
    }
  }, [isHidden, flush]);

  const isKeyboardInPaneNow = useCallback(() => flagRef.current, []);

  const requestPanelFocus = useCallback(
    (request: PanelFocusRequest) => {
      pendingRef.current = request;
      setFlag(true);
      flush();
    },
    [setFlag, flush],
  );

  const enterPane = useCallback(() => {
    if (isHidden) {
      applySidePane({ isHidden: false, tabIndex });
    }
    requestPanelFocus("current");
  }, [isHidden, tabIndex, applySidePane, requestPanelFocus]);

  const switchPanel = useCallback(
    (delta: 1 | -1) => {
      // The old panel is still mounted until the switch commits.
      panelRef.current = null;
      applySidePane({ isHidden: false, tabIndex: (tabIndex + delta + tabCount) % tabCount });
      requestPanelFocus("current");
    },
    [tabIndex, tabCount, applySidePane, requestPanelFocus],
  );

  const recoverFocus = useCallback(() => requestPanelFocus("active"), [requestPanelFocus]);

  const releaseKeyboard = useCallback(() => {
    setFlag(false);
    pendingRef.current = null;
  }, [setFlag]);

  const returnToReader = useCallback(() => {
    setFlag(false);
    pendingRef.current = null;
    const active = document.activeElement;
    if (active instanceof HTMLElement && isInSidePane(active)) {
      active.blur();
    }
  }, [setFlag]);

  const registerPanel = useCallback(
    (panel: SidePanelRegistration) => {
      panelRef.current = panel;
      flush();
      return () => {
        if (panelRef.current === panel) {
          panelRef.current = null;
        }
      };
    },
    [flush],
  );

  // The reader stays mounted behind the bookshelf, so the listeners are attached only while
  // the reader view is active.
  useEffect(() => {
    if (activeView !== "reader") {
      releaseKeyboard();
      return;
    }
    const onPointerDown = () => {
      releaseKeyboard();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (isInSidePane(e.target)) {
        setFlag(true);
      }
    };
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target;
      if (
        target === document.body ||
        target === document.documentElement ||
        !(target instanceof Element) ||
        isInSidePane(target) ||
        isInOpenModal(target)
      ) {
        return;
      }
      releaseKeyboard();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [activeView, releaseKeyboard, setFlag]);

  const value = useMemo<SidePaneFocusApi>(
    () => ({
      isKeyboardInPane,
      isKeyboardInPaneNow,
      enterPane,
      returnToReader,
      switchPanel,
      recoverFocus,
      requestPanelFocus,
      releaseKeyboard,
      registerPanel,
    }),
    [
      isKeyboardInPane,
      isKeyboardInPaneNow,
      enterPane,
      returnToReader,
      switchPanel,
      recoverFocus,
      requestPanelFocus,
      releaseKeyboard,
      registerPanel,
    ],
  );

  return <SidePaneFocusContext.Provider value={value}>{children}</SidePaneFocusContext.Provider>;
}

/**
 * Reads the keyboard-in-pane state and the side pane's focus commands.
 *
 * @returns The side pane's focus API.
 * @throws Error outside {@link SidePaneFocusProvider}.
 */
export const useSidePaneFocus = (): SidePaneFocusApi => {
  const context = useContext(SidePaneFocusContext);
  if (!context) {
    throw new Error("Side-pane focus hooks must be used inside SidePaneFocusProvider");
  }
  return context;
};

/**
 * Registers the active panel on mount and unregisters it on unmount. The latest `focus` is kept
 * in a ref, so only a change of `ready` re-registers (and runs a pending request).
 *
 * @param focus - Focuses the panel as requested.
 * @param ready - Whether the panel can take focus now (`false` while it is loading).
 * @throws Error outside {@link SidePaneFocusProvider}.
 */
export const useRegisterSidePanel = (
  focus: (request: PanelFocusRequest) => void,
  ready: boolean,
): void => {
  const { registerPanel } = useSidePaneFocus();
  const focusRef = useRef(focus);
  useLayoutEffect(() => {
    focusRef.current = focus;
  });
  useEffect(
    () => registerPanel({ focus: (request) => focusRef.current(request), ready }),
    [registerPanel, ready],
  );
};
