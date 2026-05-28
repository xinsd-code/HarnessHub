import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: mocks.open,
}));

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  delete (window as Window & { __TAURI_INTERNALS__?: unknown })
    .__TAURI_INTERNALS__;
});

describe("platform dialog boundary", () => {
  it("returns unsupported in web mode without importing the Tauri dialog", async () => {
    const { openDirectoryPicker, openFilePicker } = await import(
      "@/lib/platform/dialog"
    );

    await expect(openDirectoryPicker()).resolves.toEqual({
      status: "unsupported",
    });
    await expect(openFilePicker()).resolves.toEqual({ status: "unsupported" });
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it("returns selected paths in desktop mode", async () => {
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ =
      {};
    mocks.open.mockResolvedValueOnce("/tmp/project");

    const { openDirectoryPicker, selectedPickerPath } = await import(
      "@/lib/platform/dialog"
    );

    const result = await openDirectoryPicker({ title: "Pick directory" });

    expect(result).toEqual({ status: "selected", path: "/tmp/project" });
    expect(selectedPickerPath(result)).toBe("/tmp/project");
    expect(mocks.open).toHaveBeenCalledWith({
      directory: true,
      title: "Pick directory",
    });
  });

  it("distinguishes cancellation from unsupported picker calls", async () => {
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ =
      {};
    mocks.open.mockResolvedValueOnce(null);

    const { openFilePicker, selectedPickerPath } = await import(
      "@/lib/platform/dialog"
    );

    const result = await openFilePicker({ title: "Pick file" });

    expect(result).toEqual({ status: "cancelled" });
    expect(selectedPickerPath(result)).toBeNull();
  });
});
