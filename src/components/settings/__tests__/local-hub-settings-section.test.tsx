import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocalHubSettingsSection } from "@/components/settings/local-hub-settings-section";

const mocks = vi.hoisted(() => ({
  api: {
    getLocalHubSettings: vi.fn(),
    setLocalHubDir: vi.fn(),
  },
  dialog: {
    openDirectoryPicker: vi.fn(),
    selectedPickerPath: vi.fn(),
  },
  transport: {
    isDesktop: vi.fn(),
  },
  hubState: {
    fetch: vi.fn(),
    refreshHubSettings: vi.fn(),
  },
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/invoke", () => ({ api: mocks.api }));
vi.mock("@/lib/platform/dialog", () => ({
  openDirectoryPicker: mocks.dialog.openDirectoryPicker,
  PICKER_UNSUPPORTED_MESSAGE: "unsupported",
  selectedPickerPath: mocks.dialog.selectedPickerPath,
}));
vi.mock("@/lib/transport", () => ({
  isDesktop: mocks.transport.isDesktop,
}));
vi.mock("@/stores/hub-store", () => ({
  useHubStore: (selector: (state: typeof mocks.hubState) => unknown) =>
    selector(mocks.hubState),
}));
vi.mock("@/stores/toast-store", () => ({
  toast: mocks.toast,
}));

describe("LocalHubSettingsSection", () => {
  beforeEach(() => {
    mocks.api.getLocalHubSettings.mockReset();
    mocks.api.setLocalHubDir.mockReset();
    mocks.dialog.openDirectoryPicker.mockReset();
    mocks.dialog.selectedPickerPath.mockReset();
    mocks.transport.isDesktop.mockReset();
    mocks.hubState.fetch.mockReset();
    mocks.hubState.refreshHubSettings.mockReset();
    mocks.toast.success.mockReset();
    mocks.toast.error.mockReset();
    mocks.toast.info.mockReset();
  });

  it("loads the current hub path and migrates assets when saving a new directory", async () => {
    mocks.transport.isDesktop.mockReturnValue(true);
    mocks.api.getLocalHubSettings.mockResolvedValue({
      effective_path: "/Users/xinsd/.harnesshub",
      configured_path: null,
      default_path: "/Users/xinsd/.harnesshub",
      asset_count: 3,
      skills_count: 2,
      mcp_count: 1,
    });
    mocks.dialog.openDirectoryPicker.mockResolvedValue({ status: "selected" });
    mocks.dialog.selectedPickerPath.mockReturnValue(
      "/Users/xinsd/projects/hub",
    );
    mocks.api.setLocalHubDir.mockResolvedValue({
      effective_path: "/Users/xinsd/projects/hub",
      configured_path: "/Users/xinsd/projects/hub",
      default_path: "/Users/xinsd/.harnesshub",
      asset_count: 3,
      skills_count: 2,
      mcp_count: 1,
    });

    render(<LocalHubSettingsSection />);

    await waitFor(() =>
      expect(screen.getByDisplayValue("/Users/xinsd/.harnesshub")).toBeTruthy(),
    );
    expect(screen.getByText(/effective path/i)).toBeTruthy();
    expect(screen.getByText(/default path/i)).toBeTruthy();
    expect(screen.getByText(/assets/i)).toBeTruthy();
    expect(
      screen.queryByText(/using \/users\/xinsd\/\.harnesshub/i),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /browse/i }));
    await waitFor(() =>
      expect(
        screen.getByDisplayValue("/Users/xinsd/projects/hub"),
      ).toBeTruthy(),
    );

    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    fireEvent.click(screen.getByRole("button", { name: /migrate assets/i }));

    await waitFor(() => {
      expect(mocks.api.setLocalHubDir).toHaveBeenCalledWith(
        "/Users/xinsd/projects/hub",
        true,
      );
      expect(mocks.hubState.refreshHubSettings).toHaveBeenCalledTimes(1);
      expect(mocks.hubState.fetch).toHaveBeenCalledTimes(1);
      expect(mocks.toast.success).toHaveBeenCalledWith(
        "Exts Hub assets migrated",
      );
    });
  });

  it("can switch to a new empty directory without migrating assets", async () => {
    mocks.transport.isDesktop.mockReturnValue(false);
    mocks.api.getLocalHubSettings.mockResolvedValue({
      effective_path: "/Users/xinsd/.harnesshub",
      configured_path: "/Users/xinsd/.harnesshub",
      default_path: "/Users/xinsd/.harnesshub",
      asset_count: 1,
      skills_count: 1,
      mcp_count: 0,
    });
    mocks.api.setLocalHubDir.mockResolvedValue({
      effective_path: "/Users/xinsd/empty-hub",
      configured_path: "/Users/xinsd/empty-hub",
      default_path: "/Users/xinsd/.harnesshub",
      asset_count: 0,
      skills_count: 0,
      mcp_count: 0,
    });

    render(<LocalHubSettingsSection />);

    await waitFor(() =>
      expect(screen.getByDisplayValue("/Users/xinsd/.harnesshub")).toBeTruthy(),
    );

    fireEvent.change(screen.getByDisplayValue("/Users/xinsd/.harnesshub"), {
      target: { value: "/Users/xinsd/empty-hub" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    fireEvent.click(screen.getByRole("button", { name: /use new empty dir/i }));

    await waitFor(() => {
      expect(mocks.api.setLocalHubDir).toHaveBeenCalledWith(
        "/Users/xinsd/empty-hub",
        false,
      );
      expect(mocks.toast.success).toHaveBeenCalledWith(
        "Exts Hub directory updated",
      );
    });
  });
});
