import { fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentWindow: vi.fn(),
  startDragging: vi.fn(() => Promise.resolve()),
  toggleMaximize: vi.fn(() => Promise.resolve()),
  minimize: vi.fn(() => Promise.resolve()),
  maximize: vi.fn(() => Promise.resolve()),
  close: vi.fn(() => Promise.resolve()),
  setTheme: vi.fn(() => Promise.resolve()),
  onFocusChanged: vi.fn((callback: (event: { payload: boolean }) => void) => {
    callback({ payload: true });
    callback({ payload: false });
    return Promise.resolve(() => undefined);
  }),
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

const originalScrollTo = Element.prototype.scrollTo;

afterEach(() => {
  if (originalScrollTo) {
    Element.prototype.scrollTo = originalScrollTo;
  } else {
    delete (Element.prototype as { scrollTo?: Element["scrollTo"] }).scrollTo;
  }
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  delete (window as Window & { __TAURI_INTERNALS__?: unknown })
    .__TAURI_INTERNALS__;
});

describe("platform window boundary", () => {
  beforeEach(() => {
    mocks.getCurrentWindow.mockReset();
    mocks.startDragging.mockReset().mockResolvedValue(undefined);
    mocks.toggleMaximize.mockReset().mockResolvedValue(undefined);
    mocks.minimize.mockReset().mockResolvedValue(undefined);
    mocks.maximize.mockReset().mockResolvedValue(undefined);
    mocks.close.mockReset().mockResolvedValue(undefined);
    mocks.setTheme.mockReset().mockResolvedValue(undefined);
    mocks.onFocusChanged
      .mockReset()
      .mockImplementation((callback: (event: { payload: boolean }) => void) => {
        callback({ payload: true });
        callback({ payload: false });
        return Promise.resolve(() => undefined);
      });
  });

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

  it("keeps exported window controls as no-ops in web mode", async () => {
    const {
      startWindowDrag,
      toggleWindowMaximize,
      minimizeWindow,
      maximizeWindow,
      closeWindow,
      setWindowTheme,
      onWindowFocusChanged,
    } = await import("@/lib/platform/window");

    await expect(startWindowDrag()).resolves.toBeUndefined();
    await expect(toggleWindowMaximize()).resolves.toBeUndefined();
    await expect(minimizeWindow()).resolves.toBeUndefined();
    await expect(maximizeWindow()).resolves.toBeUndefined();
    await expect(closeWindow()).resolves.toBeUndefined();
    await expect(setWindowTheme("dark")).resolves.toBeUndefined();
    await expect(onWindowFocusChanged(() => undefined)).resolves.toEqual(
      expect.any(Function),
    );

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
    const focusEvents: boolean[] = [];
    const unlisten = await onWindowFocusChanged((focused) => {
      focusEvents.push(focused);
    });

    expect(mocks.startDragging).toHaveBeenCalledTimes(1);
    expect(mocks.toggleMaximize).toHaveBeenCalledTimes(1);
    expect(mocks.minimize).toHaveBeenCalledTimes(1);
    expect(mocks.maximize).toHaveBeenCalledTimes(1);
    expect(mocks.close).toHaveBeenCalledTimes(1);
    expect(mocks.setTheme).toHaveBeenCalledWith("dark");
    expect(mocks.onFocusChanged).toHaveBeenCalledTimes(1);
    expect(focusEvents).toEqual([true, false]);
    expect(typeof unlisten).toBe("function");
  });

  it("does not reject when a Tauri window method rejects", async () => {
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ =
      {};
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mocks.startDragging.mockRejectedValue(new Error("drag failed"));
    mocks.getCurrentWindow.mockReturnValue({
      startDragging: mocks.startDragging,
    });

    const { startWindowDrag } = await import("@/lib/platform/window");

    await expect(startWindowDrag()).resolves.toBeUndefined();
    expect(mocks.startDragging).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      "Tauri window operation failed: start window drag",
      expect.any(Error),
    );
  });

  it("returns a noop cleanup when Tauri focus listener registration rejects", async () => {
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ =
      {};
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mocks.onFocusChanged.mockRejectedValue(new Error("listener failed"));
    mocks.getCurrentWindow.mockReturnValue({
      onFocusChanged: mocks.onFocusChanged,
    });

    const { onWindowFocusChanged } = await import("@/lib/platform/window");

    const cleanup = await onWindowFocusChanged(() => undefined);

    expect(typeof cleanup).toBe("function");
    expect(() => cleanup()).not.toThrow();
    expect(mocks.onFocusChanged).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      "Tauri window listener failed: window focus changed",
      expect.any(Error),
    );
  });
});
