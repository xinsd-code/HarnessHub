import { fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentWindow: vi.fn(),
  startDragging: vi.fn(() => Promise.resolve()),
  toggleMaximize: vi.fn(() => Promise.resolve()),
  minimize: vi.fn(() => Promise.resolve()),
  maximize: vi.fn(() => Promise.resolve()),
  close: vi.fn(() => Promise.resolve()),
  setTheme: vi.fn(() => Promise.resolve()),
  onFocusChanged: vi.fn(() => Promise.resolve(() => undefined)),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: mocks.getCurrentWindow,
}));

vi.mock("@/components/layout/sidebar", () => ({
  Sidebar: () => <nav>Sidebar</nav>,
}));

vi.mock("@/components/shared/toast-container", () => ({
  ToastContainer: () => null,
}));

const projectState = {
  projects: [],
  loaded: true,
  loading: false,
  loadProjects: vi.fn(() => Promise.resolve()),
};

const scopeState = {
  hydrated: true,
  current: { type: "global" as const },
  hydrate: vi.fn(),
};

vi.mock("@/stores/project-store", () => ({
  useProjectStore: Object.assign(
    (selector: (state: typeof projectState) => unknown) =>
      selector(projectState),
    { getState: () => projectState },
  ),
}));

vi.mock("@/stores/scope-store", () => ({
  useScopeStore: Object.assign(
    (selector: (state: typeof scopeState) => unknown) => selector(scopeState),
    { getState: () => scopeState },
  ),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.clearAllMocks();
  delete (window as Window & { __TAURI_INTERNALS__?: unknown })
    .__TAURI_INTERNALS__;
});

describe("platform window boundary", () => {
  it("keeps AppShell window gestures safe in web mode", async () => {
    Element.prototype.scrollTo = vi.fn();
    const { AppShell } = await import("@/components/layout/app-shell");

    render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>,
    );

    fireEvent.mouseDown(document.body, { button: 0 });
    fireEvent.doubleClick(document.body);

    expect(mocks.getCurrentWindow).not.toHaveBeenCalled();
  });

  it("forwards window controls to Tauri when the runtime is present", async () => {
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ =
      {};
    mocks.getCurrentWindow.mockReturnValue({
      startDragging: mocks.startDragging,
      toggleMaximize: mocks.toggleMaximize,
      minimize: mocks.minimize,
      maximize: mocks.maximize,
      close: mocks.close,
      setTheme: mocks.setTheme,
      onFocusChanged: mocks.onFocusChanged,
    });

    const {
      startWindowDrag,
      toggleWindowMaximize,
      minimizeWindow,
      maximizeWindow,
      closeWindow,
      setWindowTheme,
      onWindowFocusChanged,
    } = await import("@/lib/platform/window");

    await startWindowDrag();
    await toggleWindowMaximize();
    await minimizeWindow();
    await maximizeWindow();
    await closeWindow();
    await setWindowTheme("dark");
    const unlisten = await onWindowFocusChanged(() => undefined);

    expect(mocks.startDragging).toHaveBeenCalledTimes(1);
    expect(mocks.toggleMaximize).toHaveBeenCalledTimes(1);
    expect(mocks.minimize).toHaveBeenCalledTimes(1);
    expect(mocks.maximize).toHaveBeenCalledTimes(1);
    expect(mocks.close).toHaveBeenCalledTimes(1);
    expect(mocks.setTheme).toHaveBeenCalledWith("dark");
    expect(mocks.onFocusChanged).toHaveBeenCalledTimes(1);
    expect(typeof unlisten).toBe("function");
  });
});
