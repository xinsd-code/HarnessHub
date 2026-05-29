import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  check: vi.fn(),
  relaunch: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: mocks.check,
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: mocks.relaunch,
}));

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  delete (window as Window & { __TAURI_INTERNALS__?: unknown })
    .__TAURI_INTERNALS__;
});

describe("platform updater boundary", () => {
  it("keeps updater calls as no-ops in web mode", async () => {
    const { checkDesktopUpdate, relaunchDesktopApp } = await import(
      "@/lib/platform/updater"
    );

    await expect(checkDesktopUpdate()).resolves.toBeNull();
    await expect(relaunchDesktopApp()).resolves.toBeUndefined();
    expect(mocks.check).not.toHaveBeenCalled();
    expect(mocks.relaunch).not.toHaveBeenCalled();
  });

  it("forwards updater calls in desktop mode", async () => {
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ =
      {};
    const update = {
      version: "1.2.3",
      body: "notes",
      downloadAndInstall: vi.fn(),
    };
    mocks.check.mockResolvedValueOnce(update);
    mocks.relaunch.mockResolvedValueOnce(undefined);

    const { checkDesktopUpdate, relaunchDesktopApp } = await import(
      "@/lib/platform/updater"
    );

    await expect(checkDesktopUpdate()).resolves.toBe(update);
    await expect(relaunchDesktopApp()).resolves.toBeUndefined();
    expect(mocks.check).toHaveBeenCalledTimes(1);
    expect(mocks.relaunch).toHaveBeenCalledTimes(1);
  });
});
