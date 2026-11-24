import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { useAppSelector } from "../../../store/store";
import { useSidePaneFocus } from "../../SidePane/SidePaneFocusContext";
import { useReadingDirection } from "../hooks/useReadingDirection";
import { mouseButtonName, parseCombo } from "./combo";
import { type DispatchContext, dispatchReaderInput, preventSideButtonRelease } from "./dispatch";
import type { ReaderActions, ReaderInputApi } from "./types";
import { useCommonReaderActions } from "./useCommonReaderActions";

interface Registration {
  actions: React.RefObject<ReaderActions>;
  area: React.RefObject<HTMLElement | null>;
}

interface ReaderInputContextValue extends ReaderInputApi {
  /** Registers the active reader; returns its unregistration. */
  register: (registration: Registration) => () => void;
}

const ReaderInputContext = createContext<ReaderInputContextValue | null>(null);

/** Props for {@link ReaderInputProvider}. */
export interface ReaderInputProviderProps {
  /** The reader view, including the readers that register with the provider. */
  children: React.ReactNode;
}

/**
 * Receives the reader's keys and mouse buttons on `window` while the reader view is active,
 * and dispatches every input to the registered reader or the view's common actions.
 */
export function ReaderInputProvider({ children }: ReaderInputProviderProps): React.JSX.Element {
  const activeView = useAppSelector((state) => state.view.activeView);
  const toggleKey = useAppSelector((state) => state.settings.reader.comic.loupe.toggleKey);
  const direction = useReadingDirection();
  const clickMode = useAppSelector((state) => state.settings.reader.clickToTurnPages);
  const loupeToggle = useMemo(() => parseCombo(toggleKey), [toggleKey]);
  const common = useCommonReaderActions();
  const isSidePaneHidden = useAppSelector((state) => state.settings.layout.sidePane.isHidden);
  const { isKeyboardInPaneNow, recoverFocus } = useSidePaneFocus();
  const isLoading = useAppSelector((state) => state.reader.isLoading);

  const contextRef = useRef<Omit<DispatchContext, "reader" | "readingArea">>({
    isReaderActive: activeView === "reader",
    direction,
    clickMode,
    loupeToggle,
    common,
    sidePane: { isHidden: isSidePaneHidden, isKeyboardInPane: isKeyboardInPaneNow, recoverFocus },
  });
  const isLoadingRef = useRef(isLoading);
  // A layout effect, so an input between a commit and the passive effects sees the new values.
  useLayoutEffect(() => {
    isLoadingRef.current = isLoading;
    contextRef.current = {
      isReaderActive: activeView === "reader",
      direction,
      clickMode,
      loupeToggle,
      common,
      sidePane: { isHidden: isSidePaneHidden, isKeyboardInPane: isKeyboardInPaneNow, recoverFocus },
    };
  });
  const registrationRef = useRef<Registration | null>(null);

  const dispatchInput = useCallback<ReaderInputApi["dispatchInput"]>(
    (input) =>
      dispatchReaderInput(input, {
        ...contextRef.current,
        // While a book opens the reader has nothing to act on, as when no reader is mounted.
        reader: isLoadingRef.current ? null : (registrationRef.current?.actions.current ?? null),
        readingArea: () => registrationRef.current?.area.current?.getBoundingClientRect() ?? null,
      }),
    [],
  );

  const register = useCallback((registration: Registration) => {
    registrationRef.current = registration;
    return () => {
      if (registrationRef.current === registration) {
        registrationRef.current = null;
      }
    };
  }, []);

  // The reader stays mounted behind the bookshelf, so the listeners are attached only while
  // the reader view is active.
  useEffect(() => {
    if (activeView !== "reader") {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      dispatchInput({ kind: "key", event: e });
    };
    const onMouseDown = (e: MouseEvent) => {
      if (mouseButtonName(e.button) === null) {
        return;
      }
      const area = registrationRef.current?.area.current;
      dispatchInput({
        kind: "button",
        event: e,
        inReadingArea: area?.contains(e.target as Node) ?? false,
      });
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", preventSideButtonRelease);
    window.addEventListener("auxclick", preventSideButtonRelease);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", preventSideButtonRelease);
      window.removeEventListener("auxclick", preventSideButtonRelease);
    };
  }, [activeView, dispatchInput]);

  const value = useMemo(() => ({ dispatchInput, register }), [dispatchInput, register]);

  return <ReaderInputContext.Provider value={value}>{children}</ReaderInputContext.Provider>;
}

const useReaderInputContext = (): ReaderInputContextValue => {
  const context = useContext(ReaderInputContext);
  if (!context) {
    throw new Error("Reader input hooks must be used inside ReaderInputProvider");
  }
  return context;
};

/**
 * Hands inputs received outside `window` (the reading area, the EPUB iframe) to the
 * dispatcher.
 *
 * @returns The dispatcher.
 * @throws Error outside {@link ReaderInputProvider}.
 */
export const useReaderInput = (): ReaderInputApi => useReaderInputContext();

/**
 * Registers the active reader on mount and unregisters it on unmount. The latest actions are
 * kept in a ref, so a page turn does not re-register.
 *
 * @param actions - What the reader does for page moves, jumps to either end, and the loupe.
 * @param area - The reading area; a mouse button toggles the loupe only over it.
 * @throws Error outside {@link ReaderInputProvider}.
 */
export const useRegisterReaderActions = (
  actions: ReaderActions,
  area: React.RefObject<HTMLElement | null>,
): void => {
  const { register } = useReaderInputContext();
  const actionsRef = useRef(actions);
  useLayoutEffect(() => {
    actionsRef.current = actions;
  });
  useEffect(() => register({ actions: actionsRef, area }), [register, area]);
};
