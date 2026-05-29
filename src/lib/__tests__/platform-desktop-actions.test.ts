import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isDesktop: vi.fn(() => false),
  transport: vi.fn(),
}));

vi.mock("@/lib/transport", () => {
  return {
    isDesktop: mocks.isDesktop,
    transport: mocks.transport,
  };
});

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  delete (window as Window & { __TAURI_INTERNALS__?: unknown })
    .__TAURI_INTERNALS__;
});

describe("platform desktop actions", () => {
  it("keeps desktop-only actions as no-ops in web mode", async () => {
    const { openPathInSystem, revealPathInFileManager, setDesktopAppIcon } =
      await import("@/lib/platform/desktop-actions");

    await openPathInSystem("/tmp/file");
    await revealPathInFileManager("/tmp/file");
    await setDesktopAppIcon("classic");

    expect(mocks.transport).not.toHaveBeenCalled();
  });

  it("calls desktop commands through the platform boundary in desktop mode", async () => {
    mocks.isDesktop.mockReturnValue(true);
    mocks.transport.mockResolvedValue(undefined);

    const { openPathInSystem, revealPathInFileManager, setDesktopAppIcon } =
      await import("@/lib/platform/desktop-actions");

    await openPathInSystem("/tmp/file");
    await revealPathInFileManager("/tmp/file");
    await setDesktopAppIcon("classic");

    expect(mocks.transport).toHaveBeenCalledWith("open_in_system", {
      path: "/tmp/file",
    });
    expect(mocks.transport).toHaveBeenCalledWith("reveal_in_file_manager", {
      path: "/tmp/file",
    });
    expect(mocks.transport).toHaveBeenCalledWith("set_app_icon", {
      name: "classic",
    });
  });
});
