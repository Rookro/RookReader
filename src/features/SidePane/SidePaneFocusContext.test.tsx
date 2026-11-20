import { act, fireEvent, renderHook, screen } from "@testing-library/react";
import type React from "react";
import { useLayoutEffect } from "react";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppSelector } from "../../store/store";
import {
  createBasePreloadedState,
  createTestStore,
  mockSettingsCommands,
  renderWithProviders,
} from "../../test/utils";
import { setActiveView } from "../MainView/slice";
import {
  type PanelFocusRequest,
  type SidePaneFocusApi,
  SidePaneFocusProvider,
  useRegisterSidePanel,
  useSidePaneFocus,
} from "./SidePaneFocusContext";

interface ProbeProps {
  apiRef: { current: SidePaneFocusApi | null };
  focus: (request: PanelFocusRequest) => void;
  ready: boolean;
}

function Probe({ apiRef, focus, ready }: ProbeProps) {
  const api = useSidePaneFocus();
  useLayoutEffect(() => {
    apiRef.current = api;
  });
  useRegisterSidePanel(focus, ready);
  const isHidden = useAppSelector((state) => state.settings.layout.sidePane.isHidden);
  return (
    <>
      <div data-side-pane data-testid="pane" data-hidden={String(isHidden)}>
        <button type="button">pane</button>
      </div>
      <button type="button">outside</button>
      <div role="dialog">
        <button type="button">dialog</button>
      </div>
    </>
  );
}

const setup = ({
  ready = true,
  isHidden = false,
  tabIndex = 0,
}: {
  ready?: boolean;
  isHidden?: boolean;
  tabIndex?: number;
} = {}) => {
  const preloadedState = createBasePreloadedState();
  preloadedState.settings.layout.sidePane = { isHidden, tabIndex };
  const apiRef: { current: SidePaneFocusApi | null } = { current: null };
  const focus = vi.fn<(request: PanelFocusRequest) => void>();
  const ui = (panelFocus: (request: PanelFocusRequest) => void, panelReady: boolean, key = "a") => (
    <SidePaneFocusProvider tabCount={4}>
      <Probe key={key} apiRef={apiRef} focus={panelFocus} ready={panelReady} />
    </SidePaneFocusProvider>
  );
  const view = renderWithProviders(ui(focus, ready), { preloadedState });
  const api = () => {
    if (!apiRef.current) {
      throw new Error("The probe did not render");
    }
    return apiRef.current;
  };
  return {
    ...view,
    api,
    focus,
    /** Re-renders the panel, as another panel when `key` changes. */
    rerenderPanel: (
      panelFocus: (request: PanelFocusRequest) => void,
      panelReady: boolean,
      key?: string,
    ) => view.rerender(ui(panelFocus, panelReady, key)),
  };
};

describe("SidePaneFocusProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsCommands();
  });

  it("focuses the registered panel on its current row when entering a shown pane", () => {
    const { api, focus } = setup();

    act(() => api().enterPane());

    expect(focus).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledWith("current");
    expect(api().isKeyboardInPaneNow()).toBe(true);
    expect(api().isKeyboardInPane).toBe(true);
  });

  it("shows a hidden pane and focuses the panel only after it is shown", () => {
    const { api, focus, store } = setup({ isHidden: true });
    const hiddenAtFocus: (string | null)[] = [];
    focus.mockImplementation(() => {
      hiddenAtFocus.push(screen.getByTestId("pane").getAttribute("data-hidden"));
    });

    act(() => api().enterPane());

    expect(store.getState().settings.layout.sidePane.isHidden).toBe(false);
    expect(focus).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledWith("current");
    expect(hiddenAtFocus).toEqual(["false"]);
  });

  it("waits for a panel that is not ready", () => {
    const { api, focus, rerenderPanel } = setup({ ready: false });

    act(() => api().enterPane());
    expect(focus).not.toHaveBeenCalled();

    rerenderPanel(focus, true);
    expect(focus).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledWith("current");
  });

  it("switches panels without focusing the old one", () => {
    const { api, focus, store, rerenderPanel } = setup({ tabIndex: 3 });

    act(() => api().switchPanel(1));

    expect(store.getState().settings.layout.sidePane).toEqual({ isHidden: false, tabIndex: 0 });
    expect(focus).not.toHaveBeenCalled();

    const nextFocus = vi.fn<(request: PanelFocusRequest) => void>();
    rerenderPanel(nextFocus, true, "b");
    expect(focus).not.toHaveBeenCalled();
    expect(nextFocus).toHaveBeenCalledOnce();
    expect(nextFocus).toHaveBeenCalledWith("current");
  });

  it("wraps backwards", () => {
    const { api, store } = setup({ tabIndex: 0 });

    act(() => api().switchPanel(-1));

    expect(store.getState().settings.layout.sidePane.tabIndex).toBe(3);
  });

  it("recovers on the active row", () => {
    const { api, focus } = setup();

    act(() => api().recoverFocus());

    expect(focus).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledWith("active");
  });

  it("sets the flag on a keydown inside the pane", () => {
    const { api } = setup();

    fireEvent.keyDown(screen.getByRole("button", { name: "pane" }), { key: "Tab" });

    expect(api().isKeyboardInPaneNow()).toBe(true);
    expect(api().isKeyboardInPane).toBe(true);
  });

  it("clears the flag and the pending request on pointerdown", () => {
    const { api, focus, rerenderPanel } = setup({ ready: false });

    act(() => api().enterPane());
    fireEvent.pointerDown(document.body);
    rerenderPanel(focus, true);

    expect(focus).not.toHaveBeenCalled();
    expect(api().isKeyboardInPaneNow()).toBe(false);
    expect(api().isKeyboardInPane).toBe(false);
  });

  it("keeps the flag when focus moves to the body or into a menu or dialog", () => {
    const { api } = setup();

    act(() => api().enterPane());
    act(() => screen.getByRole("button", { name: "dialog" }).focus());
    expect(api().isKeyboardInPaneNow()).toBe(true);

    fireEvent.focusIn(document.body);
    expect(api().isKeyboardInPaneNow()).toBe(true);
  });

  it("clears the flag when focus moves to an element outside the pane", () => {
    const { api } = setup();

    act(() => api().enterPane());
    act(() => screen.getByRole("button", { name: "outside" }).focus());

    expect(api().isKeyboardInPaneNow()).toBe(false);
    expect(api().isKeyboardInPane).toBe(false);
  });

  it("returns to the reader by blurring the focused pane element", () => {
    const { api } = setup();
    const paneButton = screen.getByRole("button", { name: "pane" });

    act(() => paneButton.focus());
    fireEvent.keyDown(paneButton, { key: "Tab" });
    expect(api().isKeyboardInPaneNow()).toBe(true);

    act(() => api().returnToReader());

    expect(document.activeElement).toBe(document.body);
    expect(api().isKeyboardInPaneNow()).toBe(false);
    expect(api().isKeyboardInPane).toBe(false);
  });

  it("forgets the keyboard state when the bookshelf is shown", () => {
    const { api, store } = setup();

    act(() => api().enterPane());
    act(() => {
      store.dispatch(setActiveView("bookshelf"));
    });

    expect(api().isKeyboardInPaneNow()).toBe(false);
    expect(api().isKeyboardInPane).toBe(false);
  });

  it("throws outside the provider", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const store = createTestStore(createBasePreloadedState());
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    expect(() => renderHook(() => useSidePaneFocus(), { wrapper })).toThrow(
      "Side-pane focus hooks must be used inside SidePaneFocusProvider",
    );
    consoleSpy.mockRestore();
  });
});
